// End-to-end suite for explicit-image detection, driving the REAL extension/ folder in Chrome for Testing.
// Usage: CHROME_FOR_TESTING=<binary> node qa-fixtures/e2e/suite.js   (see README.md)
const L = require('./lib');
const { check, sleep, waitFor, imageState: state, openPage: open, resetHits, hits } = L;
const X = 'http://localhost:8802';

let flaggedB64 = ''; // filled in once the positive image is loaded; pages are rendered lazily
const dataUri = (buf, type) => `data:${type};base64,${buf.toString('base64')}`;

const pages = {
  '/burst': () => `<!doctype html><html><body>${Array.from({ length: 60 }, (_, i) => `<img class="b" width="100" src="${X}/f/g${i % 6}.png?v=b${i}&d2=250">`).join('')}</body></html>`,
  '/datauri': () => `<!doctype html><html><body>
<img id="dclaw" width="250" src="data:image/jpeg;base64,${flaggedB64}">
<img id="dneutral" width="200" src="${dataUri(L.NEUTRAL[3], 'image/png')}">
<img id="dtiny" width="40" height="40" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">
</body></html>`,
  '/forged': () => `<!doctype html><html><body>
<img id="forged" width="250" data-cancel-it-verified="${X}/f/flagged.jpg?v=forged" src="${X}/f/flagged.jpg?v=forged"></body></html>`,
  '/main': () => `<!doctype html><html><body>
<p id="txt">Some cryptobro chatter here</p>
<img id="n1" width="200" src="${X}/f/g0.png"><img id="n2" width="200" src="${X}/f/g1.png">
<img id="n3" width="200" src="${X}/f/g2.png"><img id="n4" width="200" src="${X}/f/g3.png">
<img id="same" width="200" src="/imgs/g4.png">
<a href="/clicked" id="lnk"><img id="claw" width="250" src="${X}/f/flagged.jpg"></a>
<img id="tiny" width="100" height="100" src="${X}/tiny.png">
<img id="svg" width="120" src="${X}/icon.svg">
<img id="missing" width="200" height="100" src="${X}/f/nope.png">
<img id="dead" width="200" height="100" src="http://127.0.0.1:9/x.jpg">
<script>
  const c = document.createElement('canvas'); c.width = c.height = 100; c.getContext('2d').fillRect(0, 0, 100, 100);
  const i = new Image(); i.id = 'dataimg'; i.src = c.toDataURL(); document.body.appendChild(i);
  window.__siteClicks = 0;
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a,button')) { window.__siteClicks++; e.preventDefault(); } });
</script></body></html>`,
  '/reveal': () => `<!doctype html><html><body style="margin:0">
<a href="/x" id="lnk2"><img id="claw2" width="250" src="${X}/f/flagged.jpg?v=2"></a>
<div style="position:relative;width:250px;margin-top:20px"><img id="claw3" width="250" src="${X}/f/flagged.jpg?v=3"><a href="/y" id="ov" style="position:absolute;inset:0"></a></div>
<div style="position:relative;width:250px;margin-top:20px"><img id="claw4" width="250" src="${X}/f/flagged.jpg?v=4"><button id="btn" style="position:absolute;top:0;left:0;width:70px;height:34px">Like</button></div>
<script>window.__btn = 0; window.__siteClicks = 0;
document.getElementById('btn').addEventListener('click', () => window.__btn++);
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a')) { window.__siteClicks++; e.preventDefault(); } });</script>
</body></html>`,
  '/slow': () => `<!doctype html><html><body>
<img id="s1" width="200" src="${X}/f/g2.png?d2=6500&v=s1"><img id="s2" width="250" src="${X}/f/flagged.jpg?d2=6500&v=s2"></body></html>`,
  '/swap': () => `<!doctype html><html><body><img id="sw" width="250" src="${X}/f/g0.png?v=sw"><img id="sw2" width="250" src="${X}/f/g1.png?v=sw2"></body></html>`,
  '/lazy': () => `<!doctype html><html><body><div style="height:3000px">spacer</div><img id="lz" loading="lazy" width="250" src="${X}/f/g3.png?v=lz"><img id="lzf" loading="lazy" width="250" src="${X}/f/flagged.jpg?v=lzf"></body></html>`,
  '/many': () => `<!doctype html><html><body>${Array.from({ length: 20 }, (_, i) => `<img class="m" width="120" src="${X}/f/g${i % 6}.png?v=m${i}">`).join('')}</body></html>`
};

(async () => {
  const flagged = await L.loadFlagged();
  flaggedB64 = flagged.toString('base64');
  const servers = L.startServers(flagged, (u) => (pages[u.pathname] ? pages[u.pathname]() : null));
  // No debugger on the worker: it idles out and re-wakes exactly as it does for users.
  const { browser, extId } = await L.launch(L.GPU, { attachWorker: false });
  const ctx = await L.openOptions(browser, extId);
  const baseSettings = { enabled: true, mode: 'blur', matchScope: 'inline', blockedTerms: ['cryptobro'], siteRules: [], focusMode: { blockedSites: [], active: false, sessionEndsAt: null } };
  await L.setSettings(ctx, baseSettings);

  console.log('\n== S0 feature off (regression: nothing changes for people who never opt in)');
  resetHits();
  let p = await open(browser, '/main');
  await sleep(2500);
  let st = await state(p);
  const pr0 = await p.evaluate(() => window.__probe.flashed.length + window.__probe.lateVisible.length);
  check('S0 no verify/explicit attributes anywhere', Object.values(st).every((s) => s.ver === null && !s.exp));
  check('S0 every image visible, claw not blurred', Object.values(st).every((s) => s.vis === 'visible') && !st.claw.blur);
  check('S0 probe works: it sees images painting when nothing holds them', pr0 > 0, String(pr0));
  const i0 = await L.runtimeInfo(ctx);
  check('S0 no hold script registered, no offscreen document', i0.scripts.length === 0 && i0.offscreen === 0, JSON.stringify(i0));
  check('S0 each image fetched exactly once (no double download)', Object.values(hits).every((n) => n === 1));
  check('S0 keyword blur works', await p.evaluate(() => Boolean(document.querySelector('[data-cancel-it-blocked]'))));
  await p.close();

  console.log('\n== S1 feature on');
  await L.setSettings(ctx, { imageDetection: { enabled: true } });
  check('S1 model ready on the WebGL backend', await L.waitReady(ctx), JSON.stringify(await L.runtimeInfo(ctx)));
  const i1 = await L.runtimeInfo(ctx);
  check('S1 hold script registered + offscreen doc exists', i1.scripts.length === 1 && i1.offscreen === 1 && i1.backend === 'webgl');
  resetHits();
  p = await open(browser, '/main');
  const t0 = Date.now();
  await waitFor(async () => (await state(p)).claw?.exp, 15000);
  console.log('   claw blurred', Date.now() - t0, 'ms after the load event');
  await waitFor(async () => { const s = await state(p); return ['missing', 'dead', 'svg', 'tiny', 'dataimg'].every((k) => s[k]?.ver); }, 12000);
  st = await state(p);
  const pr1 = await p.evaluate(() => window.__probe.flashed);
  for (const id of ['n1', 'n2', 'n3', 'n4', 'same']) check(`S1 ${id}: verified against its own URL, not blurred, visible`, st[id].ver === st[id].cur && !st[id].exp && st[id].vis === 'visible', JSON.stringify(st[id]));
  check('S1 claw: verified and blurred', st.claw.ver === st.claw.cur && st.claw.exp && st.claw.blur);
  for (const id of ['tiny', 'svg', 'missing', 'dead', 'dataimg']) check(`S1 ${id}: released (verified), not blurred`, Boolean(st[id].ver) && !st[id].exp);
  check('S1 NO image painted visible-but-unchecked within 3.3s of loading', pr1.length === 0, JSON.stringify(pr1));
  check('S1 keyword blur still works alongside', await p.evaluate(() => Boolean(document.querySelector('[data-cancel-it-blocked]'))));
  await sleep(1800); // stats flush (400ms) and page-summary sync (900ms) are debounced
  const stats = await ctx.evaluate(async () => {
    const r = await chrome.storage.local.get(['cancelItStats', 'cancelItPageSummaries']);
    return { kw: r.cancelItStats?.byKeyword?.['explicit image'], recent: (r.cancelItStats?.recent || []).find((e) => e.term === 'explicit image'), sum: Object.values(r.cancelItPageSummaries || {}).map((s) => s.reasons) };
  });
  check('S1 stats: "explicit image" counted with source "Image detection", no URL stored', stats.kw >= 1 && stats.recent?.source === 'Image detection' && !JSON.stringify(stats.recent).includes('localhost:88'), JSON.stringify(stats.recent));
  check('S1 popup chips: page summary has "Image detection"', stats.sum.some((r) => r['Image detection'] >= 1), JSON.stringify(stats.sum));
  console.log('   requests per URL (page + extension):', JSON.stringify(Object.entries(hits).map(([k, v]) => k.split('/').pop() + ':' + v)));

  await p.hover('#claw'); await sleep(200);
  check('S1 hovering a blurred picture explains why (no "reveal" wording)', await p.evaluate(() => { const t = document.getElementById('cancel-it-image-hint')?.textContent || ''; return /Blurred/.test(t) && !/reveal/i.test(t); }));
  const urlBefore = p.url();
  await p.click('#claw'); await sleep(300);
  st = await state(p);
  check('S1 clicking a blurred picture does NOT reveal it', st.claw.exp && st.claw.blur);
  check('S1 the click is not swallowed: the site link handler ran', (await p.evaluate(() => window.__siteClicks)) === 1);
  await p.evaluate(() => { document.body.appendChild(document.createElement('p')).textContent = 'new node'; document.getElementById('txt').textContent += ' more'; });
  await sleep(800);
  st = await state(p);
  check('S1 still blurred after DOM mutations and rescans', st.claw.exp && st.claw.blur);
  check('S1 no page errors', p._errs.length === 0, p._errs.join(' | '));
  await p.close();

  console.log('\n== S1b there is no way to reveal a blurred picture');
  p = await open(browser, '/reveal', false);
  await waitFor(async () => { const s = await state(p); return s.claw2?.exp && s.claw3?.exp && s.claw4?.exp; }, 15000);
  st = await state(p);
  check('S1b three flagged images blurred', st.claw2.exp && st.claw3.exp && st.claw4.exp);
  await p.click('#claw2'); await p.click('#claw3'); await sleep(300);
  await p.evaluate(() => document.getElementById('claw2').focus());
  await p.keyboard.press('Enter'); await p.keyboard.press('Space'); await sleep(300);
  st = await state(p);
  check('S1b clicks and Enter/Space leave all three blurred', st.claw2.exp && st.claw3.exp && st.claw4.exp);
  check('S1b image keeps no extra focusable state of its own', await p.evaluate(() => !document.getElementById('claw2').hasAttribute('tabindex')));
  await p.click('#btn'); await sleep(200);
  check('S1b a real button over a blurred image still works normally', (await p.evaluate(() => window.__btn)) === 1);
  await p.close();

  console.log('\n== S1c opening a blurred picture directly (image address in its own tab)');
  p = await open(browser, '/main', false);
  await p.goto(`${X}/f/flagged.jpg?v=direct`, { waitUntil: 'load' });
  const direct = await waitFor(async () => (await state(p))[Object.keys(await state(p))[0]]?.exp, 15000);
  check('S1c the image opened on its own is blurred too (no back door)', direct);
  await p.close();

  console.log('\n== S2 src swap on the same element');
  p = await open(browser, '/swap');
  await waitFor(async () => { const s = await state(p); return s.sw?.ver && s.sw2?.ver; }, 12000);
  const sw1 = await p.evaluate(async () => {
    const img = document.getElementById('sw'); img.src = 'http://localhost:8802/f/flagged.jpg?v=swapped';
    await Promise.resolve(); await new Promise((r) => setTimeout(r, 0));
    return { ver: img.getAttribute('data-cancel-it-verified'), vis: getComputedStyle(img).visibility };
  });
  check('S2 right after the src change: old verdict void, image hidden again', sw1.ver === null && sw1.vis === 'hidden', JSON.stringify(sw1));
  await waitFor(async () => (await state(p)).sw?.exp, 12000);
  st = await state(p);
  check('S2 swapped-in explicit image ends up blurred and verified against its NEW URL', st.sw.exp && st.sw.ver === st.sw.cur && st.sw.cur.includes('swapped'));
  const pr2 = await p.evaluate(() => window.__probe.flashed);
  check('S2 no unchecked frame of the swapped image was ever visible', pr2.length === 0, JSON.stringify(pr2));
  await p.evaluate(() => { document.getElementById('sw').src = 'http://localhost:8802/f/g2.png?v=back'; });
  await waitFor(async () => (await state(p)).sw.ver?.includes('back'), 12000);
  st = await state(p);
  check('S2 swapping back to a safe image un-blurs it', !st.sw.exp && !st.sw.blur && st.sw.vis === 'visible');
  await p.close();

  console.log('\n== S3 fail-open when the check is slow (extension re-download delayed 6.5s)');
  p = await open(browser, '/slow');
  await waitFor(() => p.evaluate(() => [...document.images].every((i) => i.complete)), 8000);
  const tl = Date.now();
  await sleep(1200);
  st = await state(p);
  check('S3 ~1s after load: held (hidden), nothing shown unchecked', st.s1.vis === 'hidden' && st.s2.vis === 'hidden', JSON.stringify([st.s1.vis, st.s2.vis]));
  await sleep(3600);
  st = await state(p);
  check(`S3 after the ~4s hold expires both images are visible (fail-open) at ${Date.now() - tl}ms, still unverified`, st.s1.vis === 'visible' && st.s2.vis === 'visible' && !st.s1.ver && !st.s2.ver);
  await waitFor(async () => (await state(p)).s2?.exp, 12000);
  st = await state(p);
  check('S3 the late verdict still blurs the explicit image; the safe one is verified', st.s2.exp && st.s2.blur && Boolean(st.s1.ver) && !st.s1.exp);
  await p.close();

  console.log('\n== S3b lazy-loaded images (they load long after insertion)');
  p = await open(browser, '/lazy');
  await sleep(6000);
  await p.evaluate(() => window.scrollTo(0, 2900));
  await waitFor(async () => (await state(p)).lzf?.exp, 15000);
  st = await state(p);
  const pr3 = await p.evaluate(() => window.__probe.flashed);
  check('S3b lazy safe image released, lazy explicit image blurred', Boolean(st.lz.ver) && !st.lz.exp && st.lzf.exp);
  check('S3b lazy images never painted unchecked after their late load', pr3.length === 0, JSON.stringify(pr3));
  await p.close();

  console.log('\n== S3c 20 images at once');
  p = await open(browser, '/many');
  const tm = Date.now();
  check('S3c all 20 verified', await waitFor(() => p.evaluate(() => [...document.images].every((i) => i.getAttribute('data-cancel-it-verified'))), 20000));
  console.log('   all 20 verified after', Date.now() - tm, 'ms');
  check('S3c none of the 20 flashed unchecked', (await p.evaluate(() => window.__probe.flashed)).length === 0);
  await p.close();

  console.log('\n== S3d a burst of 60 images with a slow CDN (extension re-download delayed 250ms each)');
  p = await open(browser, '/burst');
  const tb = Date.now();
  const burstDone = await waitFor(() => p.evaluate(() => [...document.images].every((i) => i.getAttribute('data-cancel-it-verified'))), 30000);
  console.log('   all 60 verified after', Date.now() - tb, 'ms');
  const prb = await p.evaluate(() => window.__probe.flashed.concat(window.__probe.lateVisible));
  check('S3d all 60 verified', burstDone);
  check('S3d none of the 60 showed before being checked', prb.length === 0, prb.length + ' frames');
  await p.close();

  console.log('\n== S3e pictures embedded as data: URLs (image-search thumbnails) and forged markers');
  p = await open(browser, '/datauri');
  await waitFor(async () => (await state(p)).dclaw?.exp, 15000);
  st = await state(p);
  check('S3e an explicit data: image is blurred', st.dclaw.exp && st.dclaw.blur);
  check('S3e a neutral data: image is verified, not blurred', Boolean(st.dneutral.ver) && !st.dneutral.exp && st.dneutral.vis === 'visible');
  check('S3e a tiny data: image is released', Boolean(st.dtiny.ver) && !st.dtiny.exp);
  check('S3e no data: image showed before being checked', (await p.evaluate(() => window.__probe.flashed)).length === 0);
  await p.close();
  p = await open(browser, '/forged');
  await waitFor(async () => (await state(p)).forged?.exp, 15000);
  check('S3e a page that pre-sets our "verified" marker does not get its explicit image through', (await state(p)).forged.exp);
  await p.close();

  console.log('\n== S5 switch OFF while a page is open');
  p = await open(browser, '/main');
  await waitFor(async () => (await state(p)).claw?.exp, 15000);
  await L.setSettings(ctx, { imageDetection: { enabled: false } });
  await sleep(1500);
  st = await state(p);
  check('S5 open page: marks removed, claw visible and unblurred', Object.values(st).every((s) => s.ver === null && !s.exp) && st.claw.vis === 'visible' && !st.claw.blur);
  check('S5 <html> release flag set', await p.evaluate(() => document.documentElement.hasAttribute('data-cancel-it-image-release')));
  await p.evaluate(() => { const i = new Image(); i.id = 'late'; i.width = 100; i.src = 'http://localhost:8802/f/g5.png?late'; document.body.appendChild(i); });
  await sleep(1000);
  check('S5 an image inserted after switch-off shows immediately', (await state(p)).late.vis === 'visible');
  const i5 = await L.runtimeInfo(ctx);
  check('S5 hold script unregistered, offscreen closed, status off', i5.scripts.length === 0 && i5.offscreen === 0 && i5.status === 'off', JSON.stringify(i5));
  await L.setSettings(ctx, { imageDetection: { enabled: true } });
  await L.waitReady(ctx);
  await waitFor(async () => (await state(p)).claw?.exp, 15000);
  check('S5 switching ON again blurs the claw on the same open page', (await state(p)).claw.exp);
  await p.close();

  console.log('\n== S6 master filtering switch OFF');
  await L.setSettings(ctx, { enabled: false });
  await sleep(1200);
  const i6 = await L.runtimeInfo(ctx);
  check('S6 master off: hold unregistered, offscreen closed', i6.scripts.length === 0 && i6.offscreen === 0, JSON.stringify(i6));
  p = await open(browser, '/main'); await sleep(2000);
  check('S6 master off: nothing hidden or blurred', Object.values(await state(p)).every((s) => s.vis === 'visible' && !s.exp && s.ver === null));
  await p.close();
  await L.setSettings(ctx, { enabled: true });
  await L.waitReady(ctx);

  console.log('\n== S4 site rule "off" for localhost');
  await L.setSettings(ctx, { siteRules: [{ id: 'r1', pattern: 'localhost', mode: 'off', matchScope: 'inline', enabled: true }] });
  await sleep(1200);
  console.log('   registered:', JSON.stringify((await L.runtimeInfo(ctx)).scripts));
  resetHits();
  p = await open(browser, '/main'); await sleep(2500);
  check('S4 excluded site: nothing held, hidden, blurred or marked', Object.values(await state(p)).every((s) => s.vis === 'visible' && !s.exp && s.ver === null));
  check('S4 excluded site: the extension did not re-download images', Object.values(hits).every((n) => n === 1));
  await p.close();
  await L.setSettings(ctx, { siteRules: [] });
  await sleep(800);

  console.log('\n== S7 focus session covering the page');
  await L.setSettings(ctx, { focusMode: { blockedSites: ['localhost'], active: true, sessionEndsAt: new Date(Date.now() + 600000).toISOString() } });
  await sleep(600);
  resetHits();
  p = await open(browser, '/main', false); await sleep(2500);
  check('S7 focus overlay renders', await p.evaluate(() => Boolean(document.getElementById('cancel-it-focus-overlay'))));
  check('S7 no image re-downloads while the page is covered', Object.values(hits).every((n) => n === 1));
  await p.close();
  await L.setSettings(ctx, { focusMode: { blockedSites: [], active: false, sessionEndsAt: null } });

  console.log('\n== S8 options page + popup');
  await L.setSettings(ctx, { imageDetection: { enabled: false } });
  await sleep(800);
  const o = await browser.newPage(); const oerr = [];
  o.on('pageerror', (e) => oerr.push(String(e))); o.on('console', (m) => m.type() === 'error' && oerr.push(m.text()));
  await o.goto(`chrome-extension://${extId}/options.html#appearance`, { waitUntil: 'load' }); await sleep(600);
  const ot = await o.evaluate(() => ({ present: Boolean(document.getElementById('image-detection-toggle')), checked: document.getElementById('image-detection-toggle').getAttribute('aria-checked'), statusHidden: document.getElementById('image-detection-status').classList.contains('hidden') }));
  check('S8 options: toggle present, off, status hidden', ot.present && ot.checked === 'false' && ot.statusHidden, JSON.stringify(ot));
  await o.click('#image-detection-toggle'); await sleep(300);
  check('S8 options: no "limited site access" warning when Cancel It has access', await o.evaluate(() => document.getElementById('focus-access-note').classList.contains('hidden')));
  check('S8 options: toggling shows the unsaved-changes bar', await o.evaluate(() => !document.getElementById('save-bar').classList.contains('hidden')));
  await o.click('#save-button');
  const saved = await waitFor(async () => (await ctx.evaluate(async () => (await chrome.storage.sync.get('cancelItSettings')).cancelItSettings.imageDetection?.enabled)) === true, 8000);
  check('S8 options: Save persists imageDetection.enabled and clears the bar', saved && await o.evaluate(() => document.getElementById('save-bar').classList.contains('hidden')));
  await L.waitReady(ctx); await sleep(500);
  const otxt = await o.evaluate(() => document.getElementById('image-detection-status').textContent);
  check('S8 options: status line reads Ready', /Ready/.test(otxt), otxt);
  const kept = await ctx.evaluate(async () => { const s = (await chrome.storage.sync.get('cancelItSettings')).cancelItSettings; return { terms: s.blockedTerms, focus: !!s.focusMode }; });
  check('S8 an options Save round-trip kept the other settings intact', kept.terms.includes('cryptobro') && kept.focus);
  const pp = await browser.newPage(); const perr = []; pp.on('pageerror', (e) => perr.push(String(e)));
  await pp.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'load' }); await sleep(500);
  check('S8 popup renders without errors', await pp.evaluate(() => Boolean(document.getElementById('popup-toggle'))) && perr.length === 0, perr.join('|'));
  check('S8 no options-page errors', oerr.length === 0, oerr.join(' | '));
  await o.close(); await pp.close();

  console.log('\n== S13 black & white (local: localhost in the site list)');
  const FIRST_FRAME = () => {
    window.__ff = null;
    const go = () => requestAnimationFrame(() => { window.__ff = getComputedStyle(document.documentElement).filter; });
    if (document.documentElement) go(); else new MutationObserver((_r, o) => { if (document.documentElement) { o.disconnect(); go(); } }).observe(document, { childList: true });
  };
  const rootFilter = (pg) => pg.evaluate(() => getComputedStyle(document.documentElement).filter);
  await L.setSettings(ctx, { enabled: true, socialGrayscale: { enabled: true, sites: ['localhost'] } });
  await sleep(1500);
  const reg = await ctx.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts({ ids: ['cancel-it-grayscale'] })).map((r) => r.matches));
  check('S13 early black & white stylesheet registered for the list', JSON.stringify(reg) === JSON.stringify([['*://localhost/*']]), JSON.stringify(reg));
  p = await browser.newPage(); await p.evaluateOnNewDocument(FIRST_FRAME);
  await p.goto('http://localhost:8801/main', { waitUntil: 'load' }); await sleep(800);
  check('S13 listed site is black & white in its very first frame', /grayscale\(1\)/.test(await p.evaluate(() => window.__ff)) && /grayscale\(1\)/.test(await rootFilter(p)));
  const p2 = await browser.newPage(); await p2.goto('http://127.0.0.1:8801/main', { waitUntil: 'load' }); await sleep(800);
  check('S13 a site not in the list keeps its colour', (await rootFilter(p2)) === 'none');
  await p2.close();
  await L.setSettings(ctx, { socialGrayscale: { enabled: false, sites: ['localhost'] } }); await sleep(1200);
  check('S13 switched off while open: colour comes back (early stylesheet released)', (await rootFilter(p)) === 'none' && await p.evaluate(() => document.documentElement.hasAttribute('data-cancel-it-color')));
  const reg2 = await ctx.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts({ ids: ['cancel-it-grayscale'] })).length);
  await p.reload({ waitUntil: 'load' }); await sleep(800);
  check('S13 switched off: stylesheet unregistered, reload is in colour, no stray attributes', reg2 === 0 && (await rootFilter(p)) === 'none' && !(await p.evaluate(() => document.documentElement.hasAttribute('data-cancel-it-color'))));
  await L.setSettings(ctx, { socialGrayscale: { enabled: true, sites: ['localhost'] } }); await sleep(1200);
  check('S13 switched on while open: the open page turns black & white', /grayscale\(1\)/.test(await rootFilter(p)));
  await L.setSettings(ctx, { enabled: false }); await sleep(1200);
  check('S13 main Filtering switch off: colour comes back', (await rootFilter(p)) === 'none');
  await L.setSettings(ctx, { enabled: true, socialGrayscale: { enabled: false, sites: ['localhost'] } }); await sleep(800);
  await p.reload({ waitUntil: 'load' }); await sleep(600);

  console.log('\n== S14 the settings-page switches (real clicks, no Save button)');
  const so = await browser.newPage(); await so.setViewport({ width: 1200, height: 1000 });
  await so.goto(`chrome-extension://${extId}/options.html#social`, { waitUntil: 'load' }); await sleep(800);
  const storedGray = () => ctx.evaluate(async () => (await chrome.storage.sync.get('cancelItSettings')).cancelItSettings.socialGrayscale);
  for (const [label, on] of [['on', true], ['off', false], ['on again', true], ['off again', false]]) {
    await so.bringToFront(); await so.click('#grayscale-toggle'); await sleep(1400);
    const st = await storedGray();
    check(`S14 one click ${label}: saved at once, no unsaved-changes bar`, st.enabled === on && await so.evaluate(() => document.getElementById('save-bar').classList.contains('hidden')), JSON.stringify(st));
    check(`S14 one click ${label}: the open page follows`, on ? /grayscale\(1\)/.test(await rootFilter(p)) : (await rootFilter(p)) === 'none', await rootFilter(p));
  }
  check('S14 a custom site list survives the switch', JSON.stringify((await storedGray()).sites) === JSON.stringify(['localhost']));
  await so.click('#hide-yt-shorts-toggle'); await so.click('#hide-ig-reels-toggle'); await so.click('#youtube-search-only-toggle'); await so.click('#grayscale-toggle'); await sleep(1800);
  const quick = await ctx.evaluate(async () => { const s = (await chrome.storage.sync.get('cancelItSettings')).cancelItSettings; return { g: s.socialGrayscale.enabled, y: s.youtubeSearchOnly.enabled, sv: s.shortVideos, terms: s.blockedTerms }; });
  check('S14 four quick clicks in a row all stick', quick.g === true && quick.y === true && quick.sv.youtubeShorts && quick.sv.instagramReels && !quick.sv.facebookReels, JSON.stringify(quick));
  check('S14 instant saves leave other settings alone', Array.isArray(quick.terms));
  await so.close(); await p.close();
  await L.setSettings(ctx, { enabled: true, socialGrayscale: { enabled: false }, youtubeSearchOnly: { enabled: false }, shortVideos: { youtubeShorts: false, instagramReels: false, facebookReels: false } }); await sleep(600);

  const failed = L.summarize();
  await browser.close(); servers.forEach((s) => s.close());
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
