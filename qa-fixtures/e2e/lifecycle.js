// Worker/extension lifecycle scenarios: no usable GPU, the service worker idling out, the extension going away.
// Usage: CHROME_FOR_TESTING=<binary> node qa-fixtures/e2e/lifecycle.js   (takes ~2 minutes; see README.md)
const L = require('./lib');
const { check, sleep, waitFor, imageState: state, runtimeInfo: info } = L;
const X = 'http://localhost:8802';
const page = () => `<!doctype html><html><body><img id="a" width="200" src="${X}/f/g0.png"><img id="claw" width="250" src="${X}/f/flagged.jpg"></body></html>`;
const base = (on) => ({ cancelItSettings: { enabled: true, blockedTerms: [], siteRules: [], imageDetection: { enabled: on } } });
const enable = (ctx, on = true) => ctx.evaluate(async (v) => { await chrome.storage.sync.set({ cancelItSettings: v }); }, base(on).cancelItSettings);
const load = async (browser) => { const p = await browser.newPage(); await p.goto('http://localhost:8801/main', { waitUntil: 'load' }); return p; };

(async () => {
  const flagged = await L.loadFlagged();
  const servers = L.startServers(flagged, (u) => (u.pathname === '/main' ? page() : null));

  console.log('== S10 a device without a usable GPU (WebGL unavailable)');
  let { browser, extId } = await L.launch(['--disable-gpu', '--disable-software-rasterizer'], { attachWorker: false });
  let ctx = await L.openOptions(browser, extId);
  await enable(ctx);
  check('S10 status becomes "unsupported"', await waitFor(async () => (await info(ctx)).status === 'unsupported', 60000), JSON.stringify(await info(ctx)));
  await sleep(1500);
  const i10 = await info(ctx);
  check('S10 hold script unregistered and offscreen document closed', i10.scripts.length === 0 && i10.offscreen === 0, JSON.stringify(i10));
  let p = await load(browser); await sleep(2500);
  check('S10 images are shown normally, nothing blurred or hidden', Object.values(await state(p)).every((s) => s.vis === 'visible' && !s.exp));
  await p.close(); await ctx.close();
  ctx = await L.openOptions(browser, extId, '#appearance'); await sleep(600);
  const ot = await ctx.evaluate(() => { const e = document.getElementById('image-detection-status'); return { t: e.textContent, hidden: e.classList.contains('hidden'), warn: e.classList.contains('warn'), on: document.getElementById('image-detection-toggle').getAttribute('aria-checked') }; });
  check('S10 options shows the "not available" warning while the switch is on', !ot.hidden && ot.warn && /Not available/.test(ot.t) && ot.on === 'true', JSON.stringify(ot));
  await enable(ctx, false); await sleep(1000);
  check('S10 switching off resets the status (the next "on" is a fresh retry)', (await info(ctx)).status === 'off');
  await browser.close();

  console.log('\n== S12 the service worker idles out (30s) and a new page wakes it');
  ({ browser, extId } = await L.launch(L.GPU, { attachWorker: false }));
  ctx = await L.openOptions(browser, extId);
  await enable(ctx);
  await L.waitReady(ctx);
  const t0 = Date.now(); let gone = false;
  while (Date.now() - t0 < 70000) { await sleep(3000); if ((await info(ctx)).worker === 0) { gone = true; break; } }
  const before = await info(ctx);
  console.log(`   worker terminated by the idle timeout: ${gone} after ${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(before));
  check('S12 the worker really was terminated, and the offscreen document survived', gone && before.offscreen === 1);
  p = await load(browser);
  check('S12 a new page wakes the worker and still gets its explicit image blurred', await waitFor(async () => (await state(p)).claw?.exp, 25000), JSON.stringify(await state(p)));

  console.log('\n== S11 the extension goes away while a page is open');
  await waitFor(async () => (await state(p)).a?.ver, 5000);
  // chrome.runtime.reload() unloads a command-line-loaded extension instead of reloading it, which is
  // exactly the "extension vanished under an open tab" case.
  await ctx.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await sleep(4000);
  await p.evaluate(() => { const i = new Image(); i.id = 'after'; i.width = 150; i.src = 'http://localhost:8802/f/g5.png?after'; document.body.appendChild(i); });
  await sleep(1000);
  check('S11 an image added after the extension is gone is not stuck hidden', (await p.evaluate(() => getComputedStyle(document.getElementById('after')).visibility)) === 'visible');
  await browser.close();

  const failed = L.summarize();
  servers.forEach((s) => s.close());
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', String(e).slice(0, 500)); process.exit(2); });
