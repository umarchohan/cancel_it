// Tests image-hold.css + image-hold.js ON THEIR OWN, with no extension loaded: they are the last line
// of defence when content.js / the worker / the model are unavailable, so they must guarantee a picture
// is never left invisible. Usage: CHROME_FOR_TESTING=<binary> node qa-fixtures/e2e/hold.js
const L = require('./lib');
const { check, sleep } = L;
const X = 'http://localhost:8802';
const CSS = L.fs.readFileSync(L.path.join(L.EXT, 'image-hold.css'), 'utf8');
const JS = L.fs.readFileSync(L.path.join(L.EXT, 'image-hold.js'), 'utf8');

const page = () => `<!doctype html><html><head><style>${CSS}</style><script>${JS}</script></head><body>
<img id="normal" width="120" src="${X}/f/g0.png?d=700">
<img id="nosrc" width="60" height="60">
<div id="box"></div>
<script>
  // preload, then append once complete: the load event fires while the picture is detached
  const pre = new Image(); pre.id = 'preloaded'; pre.width = 120;
  pre.onload = () => setTimeout(() => { document.getElementById('box').append(pre); window.__appendedAt = performance.now(); }, 300);
  pre.src = '${X}/f/g1.png?d=200';
  // innerHTML of an already-cached picture
  setTimeout(() => { document.getElementById('box').insertAdjacentHTML('beforeend', '<span id="wrap"><img id="viaHtml" width="120" src="${X}/f/g1.png?d=200"></span>'); window.__htmlAt = performance.now(); }, 1500);
</script></body></html>`;

(async () => {
  const servers = L.startServers(await L.loadFlagged(), (u) => (u.pathname === '/hold' ? page() : null));
  const browser = await L.puppeteer.launch({ executablePath: L.CHROME, headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.goto('http://localhost:8801/hold', { waitUntil: 'load' });
  const t0 = Date.now();
  const firstVisible = {}; const wasHiddenEarly = {};
  const ids = ['normal', 'nosrc', 'preloaded', 'viaHtml'];
  while (Date.now() - t0 < 9000) {
    const s = await p.evaluate((ids) => Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); return [id, e ? { vis: getComputedStyle(e).visibility, done: e.complete, loaded: e.hasAttribute('data-cancel-it-loaded') } : null]; })), ids);
    for (const id of ids) {
      if (!s[id]) continue;
      if (s[id].vis === 'hidden') wasHiddenEarly[id] = true;
      if (s[id].vis === 'visible' && !firstVisible[id]) firstVisible[id] = Date.now() - t0;
    }
    await sleep(100);
  }
  console.log('first visible (ms after page load):', JSON.stringify(firstVisible));
  for (const id of ids) {
    check(`hold ${id}: was held (hidden) at first`, Boolean(wasHiddenEarly[id]));
    check(`hold ${id}: becomes visible on its own (never stuck hidden)`, Boolean(firstVisible[id]));
  }
  // Expiry starts when the picture has loaded/been added, so each is visible ~4s after that point.
  // t0 is taken right after the page's load event, which is when `normal` finished loading.
  check('hold normal: visible ~4s after it loaded, not sooner and not much later', firstVisible.normal >= 3600 && firstVisible.normal <= 5000, String(firstVisible.normal));

  // End-of-hold shortcuts used by content.js
  const r = await p.evaluate(async () => {
    const img = document.createElement('img'); img.id = 'x'; img.width = 50; img.src = 'http://localhost:8802/f/g2.png?d=50'; document.body.append(img);
    await new Promise((res) => setTimeout(res, 400));
    const held = getComputedStyle(img).visibility;
    img.setAttribute('data-cancel-it-verified', 'yes');
    const afterVerified = getComputedStyle(img).visibility;
    img.removeAttribute('data-cancel-it-verified');
    const heldAgain = getComputedStyle(img).visibility;
    document.documentElement.setAttribute('data-cancel-it-image-release', '1');
    const afterRelease = getComputedStyle(img).visibility;
    return { held, afterVerified, heldAgain, afterRelease };
  });
  check('hold: verified marker releases an image at once', r.held === 'hidden' && r.afterVerified === 'visible', JSON.stringify(r));
  check('hold: <html> release flag releases everything at once', r.heldAgain === 'hidden' && r.afterRelease === 'visible', JSON.stringify(r));

  const failed = L.summarize();
  await browser.close(); servers.forEach((s) => s.close());
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
