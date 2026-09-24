// Service worker for on-device explicit-image detection. It exists for three jobs and does
// nothing else: (1) register/unregister the early "hold" stylesheet, (2) own the offscreen
// document that runs the model, (3) relay classify requests from content scripts to it.
// Everything is inert unless the user has switched "Detect explicit images" on.

const STORAGE_KEY = "cancelItSettings";
const STATUS_KEY = "cancelItImageStatus"; // storage.session: read by the options page
const HOLD_SCRIPT_ID = "cancel-it-image-hold";
const OFFSCREEN_URL = "offscreen.html";
const MESSAGE_PREFIX = "cancel-it:";

let creatingOffscreen = null;
let syncChain = Promise.resolve();

function wantsImageDetection(settings) {
  return Boolean(settings?.imageDetection?.enabled) && settings?.enabled !== false;
}

async function readSettings() {
  const result = await chrome.storage.sync.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || {};
}

async function readStatus() {
  try {
    const result = await chrome.storage.session.get([STATUS_KEY]);
    return result[STATUS_KEY] || { state: "off" };
  } catch (_error) {
    return { state: "off" };
  }
}

async function writeStatus(status) {
  try {
    await chrome.storage.session.set({ [STATUS_KEY]: status });
  } catch (_error) {
    // Status is a nicety for the options page; never let it break detection.
  }
}

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["BLOBS"],
      justification: "Runs the bundled on-device image model and reads fetched images as blobs. Nothing leaves the device."
    }).catch(async (error) => {
      // A second caller can race us; that's fine as long as the document now exists.
      if (!(await hasOffscreenDocument())) {
        throw error;
      }
    }).finally(() => {
      creatingOffscreen = null;
    });
  }

  await creatingOffscreen;
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

// Sites where the user turned filtering "off" don't need the hold stylesheet. content.js stays
// the source of truth (it also releases the page), so this only saves a pointless delay and a
// bad pattern must never stop the feature: see the fallback in syncHoldScript.
function buildExcludeMatches(settings) {
  const hosts = (settings.siteRules || [])
    .filter((rule) => rule?.enabled !== false && rule?.mode === "off" && typeof rule.pattern === "string")
    .map((rule) => rule.pattern.toLowerCase().trim())
    .filter((pattern) => /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(pattern));

  return Array.from(new Set(hosts)).map((host) => {
    // A wildcard subdomain prefix is only valid on a real multi-label domain name.
    const wildcardOk = host.includes(".") && !/^\d+(\.\d+){3}$/.test(host);
    return wildcardOk ? `*://*.${host}/*` : `*://${host}/*`;
  });
}

async function registerHoldScript(script, exists) {
  if (exists) {
    await chrome.scripting.updateContentScripts([script]);
  } else {
    await chrome.scripting.registerContentScripts([script]);
  }
}

async function syncHoldScript(shouldHold, settings) {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [HOLD_SCRIPT_ID] });

  if (!shouldHold) {
    if (existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [HOLD_SCRIPT_ID] });
    }
    return;
  }

  const script = {
    id: HOLD_SCRIPT_ID,
    css: ["image-hold.css"],
    js: ["image-hold.js"],
    matches: ["http://*/*", "https://*/*"],
    excludeMatches: buildExcludeMatches(settings),
    runAt: "document_start",
    allFrames: false,
    persistAcrossSessions: true
  };

  try {
    await registerHoldScript(script, existing.length > 0);
  } catch (_error) {
    // Most likely a site-rule pattern Chrome rejects. Register without exclusions; content.js
    // still releases excluded pages, they just briefly wait on the hold first.
    await registerHoldScript({ ...script, excludeMatches: [] }, existing.length > 0);
  }
}

async function syncImageDetection() {
  const settings = await readSettings();
  const wanted = wantsImageDetection(settings);
  let status = await readStatus();

  if (!wanted) {
    // Off (or filtering paused): tear everything down. Turning it back on later starts fresh,
    // which also gives an "unsupported" device another chance.
    await syncHoldScript(false, settings);
    await closeOffscreenDocument();
    await writeStatus({ state: "off" });
    return;
  }

  if (status.state === "unsupported") {
    await syncHoldScript(false, settings);
    return;
  }

  await syncHoldScript(true, settings);
  // Creating the document also starts loading the model, so the first image on the next page
  // doesn't pay the cold start.
  if (status.state === "off") {
    await writeStatus({ state: "loading" });
  }
  await ensureOffscreenDocument();
}

function scheduleSync() {
  syncChain = syncChain.then(syncImageDetection).catch((error) => {
    console.warn("Cancel It: image detection sync failed", error);
  });
  return syncChain;
}

async function classify(url) {
  const settings = await readSettings();
  if (!wantsImageDetection(settings)) {
    return { ok: false, reason: "disabled" };
  }

  const status = await readStatus();
  if (status.state === "unsupported") {
    return { ok: false, reason: "unsupported" };
  }

  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: `${MESSAGE_PREFIX}offscreen-classify`,
    url
  });
  return response || { ok: false, reason: "no-response" };
}

function isHttpUrl(value) {
  if (typeof value !== "string" || value.length > 8192) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch (_error) {
    return false;
  }
}

// Inline pictures (image-search thumbnails are often base64 data: URLs) need no second download,
// so they're accepted too, capped to keep messages and memory small. Raster formats only.
const MAX_DATA_URL_LENGTH = 1500000;
function isImageUrl(value) {
  if (isHttpUrl(value)) {
    return true;
  }

  return typeof value === "string"
    && value.length <= MAX_DATA_URL_LENGTH
    && /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(value);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || typeof message?.type !== "string" || !message.type.startsWith(MESSAGE_PREFIX)) {
    return false;
  }

  // Messages addressed to the offscreen document are broadcast to us too; not ours.
  if (message.target === "offscreen") {
    return false;
  }

  if (message.type === `${MESSAGE_PREFIX}classify`) {
    // Content scripts only. An extension page open in a tab also has sender.tab, so the sender's
    // URL has to be a web page, not chrome-extension://.
    if (!sender.tab || !isHttpUrl(sender.url) || !isImageUrl(message.url)) {
      sendResponse({ ok: false, reason: "bad-request" });
      return false;
    }

    classify(message.url).then(sendResponse, () => sendResponse({ ok: false, reason: "error" }));
    return true;
  }

  // Status/reset reports come from the offscreen document only.
  const fromOffscreen = !sender.tab && typeof sender.url === "string" && sender.url === chrome.runtime.getURL(OFFSCREEN_URL);
  if (!fromOffscreen) {
    return false;
  }

  if (message.type === `${MESSAGE_PREFIX}offscreen-status`) {
    const state = ["loading", "ready", "unsupported"].includes(message.state) ? message.state : "loading";
    writeStatus({ state, backend: String(message.backend || "") }).then(() => {
      if (state === "unsupported") {
        scheduleSync().then(closeOffscreenDocument).catch(() => {});
      }
    });
  }

  if (message.type === `${MESSAGE_PREFIX}offscreen-reset`) {
    // The GPU context died or inference kept failing. Drop the document; the next request
    // creates a fresh one with a fresh model.
    closeOffscreenDocument().catch(() => {});
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    scheduleSync();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  scheduleSync();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleSync();
});
