// Shared helpers for the real-extension end-to-end suites (see README.md).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const puppeteer = require(process.env.PUPPETEER_CORE_PATH || 'puppeteer-core');
const CHROME = process.env.CHROME_FOR_TESTING;
if (!CHROME) {
  console.error('Set CHROME_FOR_TESTING to a Chrome for Testing binary (see README.md).');
  process.exit(2);
}
const EXT = path.resolve(process.env.EXT_DIR || path.join(__dirname, '../../extension'));
// Unpacked extensions get an id derived from their path; needed when no service worker target is attached.
const idForPath = (p) => [...crypto.createHash('sha256').update(p).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const EXT_ID = idForPath(EXT);
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  failed.forEach((f) => console.log('FAILED:', f.name));
  return failed.length;
}

/* ---------- test images ---------- */

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// Smooth colour gradients: unmistakably neutral to the model, distinct per seed so URLs/bytes differ.
function makePng(w, h, seed) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = (40 + seed * 37 + (x * 120) / w) % 256;
      raw[o + 1] = (90 + seed * 23 + (y * 100) / h) % 256;
      raw[o + 2] = (200 - seed * 29 + ((x + y) * 40) / (w + h)) % 256;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG_1x1 = makePng(1, 1, 0);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="teal"/></svg>';
const NEUTRAL = Array.from({ length: 6 }, (_, i) => makePng(320, 240, i)); // g0.png .. g5.png

// The deterministic positive needs no explicit content: this Wikipedia photo of a cat's claw scores
// Porn ~0.99 with the bundled model (a well-known false positive). Downloaded once, or supply FLAGGED_IMAGE.
const FLAGGED_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Cat_claw_closeup.jpg/250px-Cat_claw_closeup.jpg';
async function loadFlagged() {
  if (process.env.FLAGGED_IMAGE) return fs.readFileSync(process.env.FLAGGED_IMAGE);
  const cache = path.join(os.tmpdir(), 'cancel-it-e2e-flagged.jpg');
  if (fs.existsSync(cache)) return fs.readFileSync(cache);
  const res = await fetch(FLAGGED_URL, { headers: { 'User-Agent': 'cancel-it-e2e/1.0 (local test harness)' } });
  if (!res.ok) throw new Error(`Could not download the test positive (${res.status}); set FLAGGED_IMAGE to a local file`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cache, buf);
  return buf;
}

/* ---------- servers ---------- */

const hits = {}; // url -> request count, to see double downloads
const resetHits = () => { for (const k of Object.keys(hits)) delete hits[k]; };

// Images are served from :8802 (a different origin than the pages on :8801) so they are cross-origin.
// Query knobs: d=<ms> delays every response; d2=<ms> delays only the 2nd+ request (= the extension's re-download).
function startServers(flagged, pageHandler) {
  const imageServer = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const key = u.pathname + u.search;
    hits[key] = (hits[key] || 0) + 1;
    const base = { 'Cache-Control': 'no-store' };
    const name = path.basename(u.pathname);
    let body = null; let type = 'image/png';
    if (u.pathname.startsWith('/f/')) {
      if (name === 'flagged.jpg') { body = flagged; type = 'image/jpeg'; }
      else if (/^g\d\.png$/.test(name)) body = NEUTRAL[Number(name[1])];
    } else if (u.pathname === '/tiny.png') body = PNG_1x1;
    else if (u.pathname === '/icon.svg') { body = Buffer.from(SVG); type = 'image/svg+xml'; }
    if (!body) { res.writeHead(404, base); return res.end(); }
    const delay = Number(u.searchParams.get('d') || 0) + (hits[key] >= 2 ? Number(u.searchParams.get('d2') || 0) : 0);
    setTimeout(() => { res.writeHead(200, { ...base, 'Content-Type': type }); res.end(body); }, delay);
  }).listen(8802);
  const pageServer = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/imgs/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(NEUTRAL[Number(path.basename(u.pathname)[1]) || 0]); }
    const html = pageHandler(u);
    if (html == null) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html);
  }).listen(8801);
  return [imageServer, pageServer];
}

/* ---------- browser ---------- */

// `attachWorker: false` launches without attaching to the service worker: a debugger keeps it alive,
// which would hide worker-lifecycle bugs. Drive such a browser through an extension page instead.
async function launch(extraArgs = [], { attachWorker = true } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    ...(attachWorker ? {} : { targetFilter: (t) => t.type() !== 'service_worker' }),
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox', ...extraArgs]
  });
  if (!attachWorker) return { browser, sw: null, extId: EXT_ID };
  const target = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 20000 });
  return { browser, sw: await target.worker(), extId: new URL(target.url()).host };
}

async function waitFor(fn, timeout = 20000, step = 100) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return false; await sleep(step); }
}

// Everything below runs in an extension context (worker or options page) via `ctx.evaluate`.
const setSettings = (ctx, patch) => ctx.evaluate(async (patch) => {
  const cur = (await chrome.storage.sync.get(['cancelItSettings'])).cancelItSettings || {};
  await chrome.storage.sync.set({ cancelItSettings: { ...cur, ...patch } });
}, patch);
const runtimeInfo = (ctx) => ctx.evaluate(async () => {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const offscreen = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  const background = await chrome.runtime.getContexts({ contextTypes: ['BACKGROUND'] });
  const status = (await chrome.storage.session.get(['cancelItImageStatus'])).cancelItImageStatus;
  return { scripts: scripts.map((s) => ({ id: s.id, excl: s.excludeMatches })), offscreen: offscreen.length, worker: background.length, status: status?.state, backend: status?.backend };
});
const waitReady = (ctx) => waitFor(async () => (await runtimeInfo(ctx)).status === 'ready', 60000);
const openOptions = async (browser, extId, hash = '') => {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/options.html${hash}`, { waitUntil: 'load' });
  return page;
};

// Injected before any page script: records whether an image ever painted visibly before it was verified.
const PROBE = () => {
  const P = window.__probe = { loadedAt: new Map(), flashed: [], lateVisible: [] };
  document.addEventListener('load', (e) => { if (e.target instanceof HTMLImageElement) P.loadedAt.set(e.target, performance.now()); }, true);
  const tick = () => {
    for (const img of document.images) {
      if (!img.complete || !img.naturalWidth || img.hasAttribute('data-cancel-it-verified')) continue;
      if (getComputedStyle(img).visibility === 'hidden') continue;
      const age = performance.now() - (P.loadedAt.get(img) ?? performance.now());
      (age < 3300 ? P.flashed : P.lateVisible).push(img.getAttribute('src') || img.currentSrc);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const imageState = (page) => page.evaluate(() => Object.fromEntries([...document.images].map((i) => [i.id || i.src.slice(-20), {
  ver: i.getAttribute('data-cancel-it-verified'), exp: i.hasAttribute('data-cancel-it-explicit'),
  vis: getComputedStyle(i).visibility, blur: getComputedStyle(i).filter.includes('blur'), cur: i.currentSrc
}])));
async function openPage(browser, urlPath, probe = true) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  page._errs = []; page.on('pageerror', (e) => page._errs.push(String(e)));
  if (probe) await page.evaluateOnNewDocument(PROBE);
  await page.goto('http://localhost:8801' + urlPath, { waitUntil: 'load' });
  return page;
}

module.exports = {
  puppeteer, CHROME, fs, path, os, EXT, EXT_ID, idForPath, GPU, NEUTRAL, sleep, check, summarize, results, hits, resetHits, loadFlagged, startServers,
  launch, waitFor, setSettings, runtimeInfo, waitReady, openOptions, PROBE, imageState, openPage
};
