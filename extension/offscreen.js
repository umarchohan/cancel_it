// Offscreen document: the only place the image model runs. It re-downloads an image by URL
// (no cookies), shrinks it to the model's input size, scores it on the GPU, and answers with
// three numbers. Nothing here is ever sent anywhere; the pixels never leave this document.

const MESSAGE_PREFIX = "cancel-it:";
const MODEL_URL = "models/nsfw/model.json";
const INPUT_SIZE = 224;
// Output order of the bundled NSFWJS MobileNetV2: Drawing, Hentai, Neutral, Porn, Sexy.
const CLASS_HENTAI = 1;
const CLASS_PORN = 3;
const CLASS_SEXY = 4;
// Downloads are network-bound and can overlap freely; scoring is GPU-bound and gains nothing past
// a few at a time (measured: 3 beat 6). Separate limits keep slow CDNs from starving the GPU and
// vice versa, which matters on image-heavy pages and when several tabs ask at once.
const MAX_DOWNLOADS = 8;
const MAX_SCORING = 3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 64 * 1000 * 1000;
const MAX_DECODE_SIDE = 2048;
const CACHE_LIMIT = 1000;
const RESET_AFTER_FAILURES = 5;

const cache = new Map(); // url -> result; insertion order doubles as LRU order
const inflight = new Map(); // url -> Promise, so a page requesting one URL twice downloads it once
let modelPromise = null;
let consecutiveFailures = 0;
let unsupported = false;

function report(type, extra = {}) {
  chrome.runtime.sendMessage({ target: "background", type: `${MESSAGE_PREFIX}${type}`, ...extra }).catch(() => {});
}

async function loadModel() {
  report("offscreen-status", { state: "loading" });
  await tf.ready();

  // WebGL only. The CPU fallback is 40-50x slower (about 2s per image), which would stall
  // pages far worse than not checking at all, so an unsupported device just opts out.
  if (tf.getBackend() !== "webgl") {
    unsupported = true;
    report("offscreen-status", { state: "unsupported", backend: tf.getBackend() });
    throw new Error("no-gpu");
  }

  const model = await tf.loadLayersModel(chrome.runtime.getURL(MODEL_URL));
  // The first predict compiles the GPU shaders (up to seconds on a cold machine); do it now.
  const warm = tf.tidy(() => model.predict(tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3])));
  await warm.data();
  warm.dispose();

  report("offscreen-status", { state: "ready", backend: tf.getBackend() });
  return model;
}

function getModel() {
  if (!modelPromise) {
    modelPromise = loadModel().catch((error) => {
      if (!unsupported) {
        modelPromise = null; // transient failure: allow a retry on the next request
      }
      throw error;
    });
  }
  return modelPromise;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function fetchImageBlob(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // no-store: analysed in memory and forgotten. Without it Chrome would keep a disk-cache copy of
    // every picture we re-download, which the privacy policy says we don't do.
    const response = await fetch(url, { credentials: "omit", cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`http-${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new Error("too-large");
    }

    const blob = await response.blob();
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("too-large");
    }
    return blob;
  } finally {
    clearTimeout(timer);
  }
}

async function scoreImage(url) {
  const blob = await downloadSlot(() => fetchImageBlob(url));
  if (blob.type === "image/svg+xml") {
    // Vector art; nothing to score, and rasterising untrusted SVG isn't worth the risk.
    return { ok: true, p: { porn: 0, hentai: 0, sexy: 0 }, skipped: true };
  }

  return scoringSlot(() => scoreBlob(blob));
}

async function scoreBlob(blob) {
  const model = await getModel();
  let bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error("too-large");
    }

    // Keep the transient GPU upload bounded for very large photos. 'low' matters: it is the
    // resize the model was trained with; smoother filters push ordinary photos toward "porn".
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest > MAX_DECODE_SIDE) {
      const scale = MAX_DECODE_SIDE / longest;
      const smaller = await createImageBitmap(bitmap, {
        resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
        resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
        resizeQuality: "low"
      });
      bitmap.close();
      bitmap = smaller;
    }

    // The canonical NSFWJS preprocessing: full picture, squashed (not cropped) to 224x224 with
    // aligned-corner bilinear sampling. Scores drift measurably if this is swapped for a
    // different resize, so don't "optimise" it without re-measuring false positives.
    const output = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(bitmap).toFloat().div(255);
      const resized = tf.image.resizeBilinear(pixels, [INPUT_SIZE, INPUT_SIZE], true);
      return model.predict(resized.expandDims(0));
    });
    const scores = await output.data();
    output.dispose();
    return {
      ok: true,
      p: { porn: round(scores[CLASS_PORN]), hentai: round(scores[CLASS_HENTAI]), sexy: round(scores[CLASS_SEXY]) }
    };
  } finally {
    bitmap.close();
  }
}

async function runClassify(url) {
  if (unsupported) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const result = await scoreImage(url);
    consecutiveFailures = 0;
    return result;
  } catch (error) {
    if (unsupported) {
      return { ok: false, reason: "unsupported" };
    }

    // Fetch problems (404, hotlink protection, timeout) are the image's fault, not the model's.
    const message = String(error?.message || error);
    const fetchProblem = error?.name === "AbortError" || /^(http-|too-large)/.test(message) || /Failed to fetch|NetworkError/i.test(message);
    if (!fetchProblem) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= RESET_AFTER_FAILURES) {
        consecutiveFailures = 0;
        report("offscreen-reset");
      }
    }
    return { ok: false, reason: fetchProblem ? "fetch" : "error" };
  }
}

function createLimiter(limit) {
  const waiting = [];
  let running = 0;

  const release = () => {
    running -= 1;
    const next = waiting.shift();
    if (next) {
      next();
    }
  };

  return (task) => new Promise((resolve, reject) => {
    const start = () => {
      running += 1;
      task().then(resolve, reject).finally(release);
    };

    if (running < limit) {
      start();
    } else {
      waiting.push(start);
    }
  });
}

const downloadSlot = createLimiter(MAX_DOWNLOADS);
const scoringSlot = createLimiter(MAX_SCORING);

// data: URLs can be a megabyte long; never use one as a Map key (or keep a thousand of them).
function cacheKey(url) {
  if (url.length <= 2048) {
    return url;
  }

  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < url.length; i += 1) {
    const code = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  return `${url.slice(0, 40)}…${url.length}:${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

function remember(url, result) {
  cache.delete(url);
  cache.set(url, result);
  if (cache.size > CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
}

function classify(url) {
  const key = cacheKey(url);
  const cached = cache.get(key);
  if (cached) {
    remember(key, cached); // refresh recency
    return Promise.resolve(cached);
  }

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const pending = runClassify(url).then((result) => {
    if (result.ok) {
      remember(key, result);
    }
    return result;
  }).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only the service worker (no tab) may ask us to classify.
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== "offscreen") {
    return false;
  }

  if (message.type === `${MESSAGE_PREFIX}offscreen-classify` && typeof message.url === "string") {
    classify(message.url).then(sendResponse, () => sendResponse({ ok: false, reason: "error" }));
    return true;
  }

  return false;
});

// Start loading right away so the model is warm before the first image arrives.
getModel().catch(() => {});
