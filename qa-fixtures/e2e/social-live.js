// LIVE checks of the Social media features against the real sites (needs internet). These
// break when YouTube/Instagram/Facebook change their pages; a failure here means "update the
// selectors in content.js", not necessarily a bug in our logic. Everything runs logged out,
// so logged-in feeds (YouTube home feed, Instagram/Facebook feeds) are NOT covered.
// Usage: CHROME_FOR_TESTING=<binary> node qa-fixtures/e2e/social-live.js   (~4 min)
const L = require('./lib');
const { check, sleep, waitFor } = L;

const visible = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)]
  .filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden').length, selector);
const present = (page, selector) => page.evaluate((selector) => document.querySelectorAll(selector).length, selector);
const flag = (page, name) => page.evaluate((name) => document.documentElement.hasAttribute(name), name);
// Sites (and our own redirects) can navigate again mid-check; give the page a moment and retry once.
const settle = async (fn) => { try { return await fn(); } catch (_e) { await sleep(3000); return fn(); } };
const go = (page, url) => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('   goto:', String(e).slice(0, 80)));

// Records, in the page's own world, when our grayscale flag lands and when the page first paints.
// <html> may not exist yet when this runs, so wait for it first. (Not named __t: Facebook
// and Instagram use that global themselves.)
// firstFrame: the root filter in the first animation frame, i.e. what the first paint shows.
const TIMING_PROBE = () => {
  window.__cancelItTiming = { flag: null, firstFrame: null };
  const watch = () => {
    requestAnimationFrame(() => { window.__cancelItTiming.firstFrame = getComputedStyle(document.documentElement).filter; });
    new MutationObserver(() => {
      if (window.__cancelItTiming.flag === null && document.documentElement.hasAttribute('data-cancel-it-grayscale')) window.__cancelItTiming.flag = performance.now();
    }).observe(document.documentElement, { attributes: true });
  };
  if (document.documentElement) watch();
  else new MutationObserver((_r, o) => { if (document.documentElement) { o.disconnect(); watch(); } }).observe(document, { childList: true });
};

(async () => {
  const { browser, extId } = await L.launch([], { attachWorker: false });
  const ctx = await L.openOptions(browser, extId);
  const set = (patch) => L.setSettings(ctx, patch);
  await set({ enabled: true, blockedTerms: [], siteRules: [], socialGrayscale: { enabled: false }, youtubeSearchOnly: { enabled: false }, shortVideos: { youtubeShorts: false, instagramReels: false, facebookReels: false } });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  console.log('\n== Control: YouTube autoplay with the feature OFF (proves the end-of-video check can fail)');
  await go(page, 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await waitFor(() => page.evaluate(() => { const v = document.querySelector('video'); return v && v.duration > 0; }), 20000);
  // YouTube only starts its autoplay countdown when a video really plays through its end.
  const playToEnd = () => page.evaluate(async () => { const v = document.querySelector('video'); v.muted = true; v.currentTime = v.duration - 6; try { await v.play(); } catch (e) {} });
  await playToEnd();
  const controlMoved = await waitFor(() => page.evaluate(() => !location.href.includes('jNQXAC9IVRw')), 25000, 500);
  check('control: without the feature, YouTube autoplays to another video', controlMoved, page.url());

  console.log('\n== Black & white');
  await set({ socialGrayscale: { enabled: true } });
  await sleep(1500); // the worker registers the early stylesheet
  await page.evaluateOnNewDocument(TIMING_PROBE);
  // x.com refuses automated browsers (HTTP 403), so it can't be checked here.
  for (const url of ['https://www.reddit.com/', 'https://www.facebook.com/', 'https://www.instagram.com/', 'https://www.linkedin.com/', 'https://www.tiktok.com/explore', 'https://www.youtube.com/']) {
    for (const pass of ['first visit', 'reload']) {
      if (pass === 'first visit') await go(page, url); else await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(2500);
      const t = await page.evaluate(() => ({ ...window.__cancelItTiming, paint: performance.getEntriesByName('first-paint')[0]?.startTime ?? null, filter: getComputedStyle(document.documentElement).filter, host: location.hostname }));
      check(`${t.host} (${pass}): black & white already in the very first frame`, /grayscale\(1\)/.test(t.firstFrame || '') && /grayscale\(1\)/.test(t.filter), `first frame: ${t.firstFrame}; page flag at ${t.flag?.toFixed(0)}ms, first paint ${t.paint?.toFixed(0)}ms`);
    }
  }
  // A fixed header must stay pinned while scrolling (a filter on any element but <html> breaks this).
  await go(page, 'https://www.youtube.com/results?search_query=bread'); await sleep(3500);
  const pinned = await page.evaluate(async () => {
    const header = document.querySelector('#masthead-container');
    if (!header || getComputedStyle(header).position !== 'fixed') return 'no fixed header found';
    window.scrollTo(0, 2000); await new Promise((r) => setTimeout(r, 600));
    return Math.abs(header.getBoundingClientRect().top) <= 1 && window.scrollY > 500 ? 'pinned' : `moved (top ${header.getBoundingClientRect().top}, scrollY ${window.scrollY})`;
  });
  check('YouTube in black & white: its fixed top bar stays pinned while scrolling', pinned === 'pinned' && await flag(page, 'data-cancel-it-grayscale'), pinned);
  await go(page, 'https://en.wikipedia.org/wiki/Cat'); await sleep(1500);
  check('a site not in the list keeps its colour', !(await flag(page, 'data-cancel-it-grayscale')) && (await page.evaluate(() => getComputedStyle(document.documentElement).filter)) === 'none');
  await go(page, 'https://www.reddit.com/'); await sleep(2000);
  await set({ socialGrayscale: { enabled: false } }); await sleep(1000);
  check('switching it off brings colour back on an open page', (await page.evaluate(() => getComputedStyle(document.documentElement).filter)) === 'none');
  await set({ socialGrayscale: { enabled: true }, enabled: false }); await sleep(1000);
  check('the main Filtering switch off also turns black & white off', !(await flag(page, 'data-cancel-it-grayscale')));
  await set({ enabled: true, socialGrayscale: { enabled: false } });

  console.log('\n== YouTube: search only');
  await set({ youtubeSearchOnly: { enabled: true } }); await sleep(500);
  await go(page, 'https://www.youtube.com/'); await sleep(3500);
  check('home: flag set', await flag(page, 'data-cancel-it-yt-search-only'));
  check('home: feed area hidden', (await visible(page, 'ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer')) === 0);
  check('home: search box visible', (await visible(page, 'yt-searchbox, ytd-searchbox')) > 0);
  check('home: side menu and its button hidden', (await visible(page, 'ytd-mini-guide-renderer, tp-yt-app-drawer#guide, #guide-button')) === 0);
  // In-page navigation: search from the box, then open a result, without full page loads.
  const input = 'yt-searchbox input, ytd-searchbox input#search, input[name="search_query"]';
  await page.evaluate((input) => [...document.querySelectorAll(input)].find((e) => e.getClientRects().length)?.focus(), input);
  await page.keyboard.type('how to bake bread'); await page.keyboard.press('Enter');
  await waitFor(() => page.evaluate(() => location.pathname === '/results'), 20000); await sleep(4000);
  await page.evaluate(async () => { for (let i = 0; i < 5; i++) { window.scrollBy(0, 2500); await new Promise((r) => setTimeout(r, 700)); } window.scrollTo(0, 0); });
  check('search (reached in-page): results still show', (await visible(page, 'ytd-search ytd-video-renderer')) > 3, String(await visible(page, 'ytd-search ytd-video-renderer')));
  check('search: Shorts and suggestion shelves hidden', (await visible(page, 'ytd-search grid-shelf-view-model, ytd-search ytd-reel-shelf-renderer, ytd-search ytd-shelf-renderer, ytd-search ytm-shorts-lockup-view-model')) === 0, `present: ${await present(page, 'ytd-search grid-shelf-view-model, ytd-search ytd-shelf-renderer')}`);
  await page.click('ytd-search ytd-video-renderer a#thumbnail[href*="/watch"]');
  await waitFor(() => page.evaluate(() => location.pathname === '/watch'), 20000); await sleep(5000);
  check('watch (reached in-page): related videos hidden', (await visible(page, '#related, ytd-watch-next-secondary-results-renderer')) === 0, `present: ${await present(page, 'ytd-watch-next-secondary-results-renderer yt-lockup-view-model')}`);
  check('watch: video player visible', (await visible(page, '#movie_player')) > 0);
  check('watch: autoplay switched off', await waitFor(() => page.evaluate(() => document.querySelector('.ytp-autonav-toggle-button')?.getAttribute('aria-checked') === 'false'), 10000));
  await page.setViewport({ width: 900, height: 900 }); await sleep(2000);
  check('watch at 900px wide (related moves under the video): still hidden', (await visible(page, '#related, ytd-watch-next-secondary-results-renderer')) === 0);
  await page.setViewport({ width: 1366, height: 900 });
  await go(page, 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await waitFor(() => page.evaluate(() => { const v = document.querySelector('video'); return v && v.duration > 0; }), 20000); await sleep(1500);
  await playToEnd();
  const moved = await waitFor(() => page.evaluate(() => !location.href.includes('jNQXAC9IVRw')), 20000, 500);
  check('end of a video: nothing autoplays, still on the same video 20s later', !moved, page.url());
  check('end of a video: suggestion wall hidden', (await visible(page, '#movie_player .html5-endscreen, #movie_player .ytp-endscreen-content, #movie_player .ytp-autonav-endscreen-countdown-overlay')) === 0);
  await go(page, 'https://music.youtube.com/'); await sleep(2500);
  check('music.youtube.com is left alone', !(await flag(page, 'data-cancel-it-yt-search-only')));
  await go(page, 'https://www.youtube.com/results?search_query=funny+cats'); await sleep(3000);
  await set({ youtubeSearchOnly: { enabled: false } }); await sleep(1200);
  check('switching it off restores the page (shelves and side menu back)', (await visible(page, 'ytd-search grid-shelf-view-model, ytd-mini-guide-renderer, tp-yt-app-drawer#guide')) > 0);

  console.log('\n== Short videos: YouTube Shorts (search only OFF)');
  await set({ shortVideos: { youtubeShorts: true, instagramReels: false, facebookReels: false } }); await sleep(500);
  await go(page, 'https://www.youtube.com/results?search_query=funny+cats'); await sleep(3500);
  await page.evaluate(async () => { for (let i = 0; i < 4; i++) { window.scrollBy(0, 2500); await new Promise((r) => setTimeout(r, 700)); } window.scrollTo(0, 0); });
  check('search: Shorts shelves hidden', (await visible(page, 'grid-shelf-view-model:has(ytm-shorts-lockup-view-model), ytm-shorts-lockup-view-model, ytd-reel-shelf-renderer')) === 0, `present: ${await present(page, 'ytm-shorts-lockup-view-model')}`);
  check('search: normal results still show', (await visible(page, 'ytd-search ytd-video-renderer')) > 3);
  check('search: no visible link to a Short', (await visible(page, 'ytd-search a[href^="/shorts/"]')) === 0);
  check('side menu still there, without its Shorts entry', (await visible(page, 'ytd-mini-guide-renderer, tp-yt-app-drawer#guide')) > 0 && (await visible(page, 'ytd-guide-entry-renderer:has(a[title="Shorts"]), ytd-mini-guide-entry-renderer[aria-label="Shorts"]')) === 0);
  await go(page, 'https://www.youtube.com/@YouTube'); await sleep(3500);
  check('channel page: Shorts tab hidden', (await present(page, 'yt-tab-shape')) > 0 && (await visible(page, 'yt-tab-shape[tab-title="Shorts"]')) === 0, `tabs: ${await page.evaluate(() => [...document.querySelectorAll('yt-tab-shape')].map((t) => t.getAttribute('tab-title')).join(','))}`);
  await go(page, 'https://www.youtube.com/shorts/'); await sleep(3000);
  const shortId = (page.url().match(/\/shorts\/([\w-]+)/) || page.url().match(/[?&]v=([\w-]+)/) || [])[1];
  check('a Shorts link opens as a normal video page', /\/watch\?v=/.test(page.url()), page.url());
  if (shortId) {
    await go(page, `https://www.youtube.com/shorts/${shortId}`); await sleep(2500);
    check('a direct /shorts/ID link becomes /watch?v=ID (same video)', page.url().includes(`/watch?v=${shortId}`), page.url());
  }
  await set({ shortVideos: { youtubeShorts: false, instagramReels: false, facebookReels: false } }); await sleep(500);
  if (shortId) {
    await go(page, `https://www.youtube.com/shorts/${shortId}`); await sleep(2500);
    check('with the switch off, Shorts links open normally', page.url().includes('/shorts/'), page.url());
  }

  console.log('\n== Short videos: Instagram and Facebook (logged out, so only the page-level part is checkable)');
  await go(page, 'https://www.instagram.com/reels/'); await sleep(3000);
  const igControl = new URL(page.url()).pathname;
  await go(page, 'https://www.facebook.com/reel/1'); await sleep(3000);
  const fbControl = new URL(page.url()).pathname;
  console.log(`   control (switches off): instagram -> ${igControl}, facebook -> ${fbControl}`);
  await set({ shortVideos: { youtubeShorts: false, instagramReels: true, facebookReels: true } }); await sleep(500);
  await go(page, 'https://www.instagram.com/reels/'); await sleep(3000);
  check('instagram.com/reels/ goes back to the home feed', new URL(page.url()).pathname === '/', `${page.url()} (control: ${igControl})`);
  check('instagram: hide flag set', await flag(page, 'data-cancel-it-no-ig-reels'));
  if (igControl.startsWith('/reels/')) {
    const reelId = igControl.split('/')[2];
    await go(page, `https://www.instagram.com/reel/${reelId}/`); await sleep(4000);
    const single = await settle(async () => ({ path: new URL(page.url()).pathname, video: await visible(page, 'video'), guard: await flag(page, 'data-cancel-it-ig-single-reel') }));
    check('instagram: a single shared reel (/reel/ID) still opens and shows its video', single.path.startsWith('/reel/') && single.video > 0 && single.guard, JSON.stringify(single));
  }
  await go(page, 'https://www.facebook.com/reel/1'); await sleep(3000);
  check('facebook.com/reel/… goes back to the home feed', !/^\/reels?\//.test(new URL(page.url()).pathname), `${page.url()} (control: ${fbControl})`);
  check('facebook: hide flag set', await flag(page, 'data-cancel-it-no-fb-reels'));
  await go(page, 'https://www.youtube.com/'); await sleep(2000);
  check('instagram/facebook switches leave YouTube alone', !(await flag(page, 'data-cancel-it-no-yt-shorts')) && !(await flag(page, 'data-cancel-it-yt-search-only')));

  const failed = L.summarize();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
