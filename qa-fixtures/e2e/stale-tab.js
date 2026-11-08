// A tab that was already open when the extension was reloaded/updated keeps a dead copy of the content
// script (its chrome.* calls throw), so a Focus session started afterwards silently doesn't apply to it —
// the classic "Facebook isn't blocked" case, since long-lived tabs are exactly what people keep open.
// This reproduces that with a helper extension that disables + re-enables Cancel It (an unload/load cycle,
// like a reload), then proves background.js's injectIntoOpenTabs() repairs the tab.
// Usage: CHROME_FOR_TESTING=<binary> node qa-fixtures/e2e/stale-tab.js   (~20s; see README.md)
const L = require('./lib');
const { fs, path, os, sleep, check } = L;

// realpath: on macOS the temp dir is a symlink, and Chrome derives extension ids from the resolved path
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cancel-it-stale-')));
const extCopy = path.join(work, 'extension');
const helper = path.join(work, 'helper');
fs.cpSync(L.EXT, extCopy, { recursive: true });
// The copy gets a debug hook to trigger the same function onInstalled calls (a real reload fires onInstalled).
fs.appendFileSync(path.join(extCopy, 'background.js'), `
chrome.runtime.onMessage.addListener((m, s, r) => {
  if (m?.type === 'debug:inject') { injectIntoOpenTabs().then(() => r('done'), (e) => r('ERR ' + e)); return true; }
});`);
fs.mkdirSync(helper);
fs.writeFileSync(path.join(helper, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Helper', version: '1.0', permissions: ['management'] }));
fs.writeFileSync(path.join(helper, 'helper.html'), '<!doctype html><title>helper</title>');
const EXT_ID = L.idForPath(extCopy);
const HELPER_ID = L.idForPath(helper);

(async () => {
  const servers = L.startServers(await L.loadFlagged(), (u) => (u.pathname === '/main' ? '<!doctype html><html><body><h1>page</h1></body></html>' : null));
  const browser = await L.puppeteer.launch({
    executablePath: L.CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], targetFilter: (t) => t.type() !== 'service_worker',
    args: [`--disable-extensions-except=${extCopy},${helper}`, `--load-extension=${extCopy},${helper}`, '--no-sandbox']
  });
  const h = await browser.newPage(); await h.goto(`chrome-extension://${HELPER_ID}/helper.html`);
  const targetId = await h.evaluate(async () => (await chrome.management.getAll()).find((e) => e.name === 'Cancel It')?.id);
  const ext = async (fn, ...args) => { const o = await browser.newPage(); await o.goto(`chrome-extension://${EXT_ID}/options.html`); const r = await o.evaluate(fn, ...args); await o.close(); return r; };
  const session = (active) => ext((active, ends) => chrome.storage.sync.set({ cancelItSettings: { enabled: true, blockedTerms: [], focusMode: { blockedSites: ['localhost'], active, sessionEndsAt: active ? ends : null } } }), active, new Date(Date.now() + 600000).toISOString());
  const overlay = (p) => p.evaluate(() => Boolean(document.getElementById('cancel-it-focus-overlay')));

  check('helper found Cancel It', targetId === EXT_ID, `${targetId} vs ${EXT_ID}`);
  await session(false);
  const p = await browser.newPage(); await p.goto('http://localhost:8801/main', { waitUntil: 'load' }); await sleep(800);
  await session(true); await sleep(1200);
  check('a live tab gets the focus overlay when a session starts', await overlay(p));
  await session(false); await sleep(1200);
  check('the overlay clears when the session ends', !(await overlay(p)));

  // Make the tab look opened under an older version: its stylesheet lacks the newest rule.
  await p.evaluate(() => { const s = document.getElementById('cancel-it-styles'); s.textContent = s.textContent.replace(/html\[data-cancel-it-grayscale\][^}]*}/, ''); });
  await h.evaluate((id) => chrome.management.setEnabled(id, false), targetId); await sleep(1500);
  await h.evaluate((id) => chrome.management.setEnabled(id, true), targetId); await sleep(3000);
  await session(true); await sleep(1500);
  check('after the extension reloads, the already-open tab ignores a new session (the bug)', !(await overlay(p)));

  check('injectIntoOpenTabs() runs cleanly', (await ext(() => chrome.runtime.sendMessage({ type: 'debug:inject' }))) === 'done');
  check('...and the stale tab now shows the focus overlay (the fix)', await L.waitFor(() => overlay(p), 8000));
  check('...and the repaired tab gets the current stylesheet, not the old version\'s', await p.evaluate(() => document.getElementById('cancel-it-styles').textContent.includes('data-cancel-it-grayscale')));
  check('running it again is harmless', (await ext(() => chrome.runtime.sendMessage({ type: 'debug:inject' }))) === 'done');
  await session(false); await sleep(1500);
  check('the session still ends cleanly afterwards', !(await overlay(p)));

  const failed = L.summarize();
  await browser.close(); servers.forEach((s) => s.close()); fs.rmSync(work, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(2); });
