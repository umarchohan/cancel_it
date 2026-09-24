# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cancel It — a Manifest V3 Chrome extension that hides, blurs, or replaces user-chosen keywords on webpages, plus an opt-in on-device detector that blurs explicit images. Vanilla JS/CSS/HTML in `extension/`; no build step, no package manager, no test framework. (The image model's runtime and weights are vendored binaries under `extension/vendor/` and `extension/models/` — regenerate them with `tools/vendor-image-model.sh`, never hand-edit.)

## Commands

```sh
# Syntax-check after JS edits (only automated check available)
node --check extension/options.js extension/popup.js extension/content.js extension/analytics.js \
  extension/background.js extension/offscreen.js extension/image-hold.js

# Regenerate the browser preview pages after editing options.html or popup.html
./qa-fixtures/regen-previews.sh

# Build the Chrome Web Store package (bump "version" in manifest.json FIRST —
# the dashboard rejects a version it has already seen)
cd extension && zip -r ../dist/cancel-it-<version>.zip . \
  -x "icons/*" -x "previews/*" -x "PRIVACY.html" -x "*.DS_Store" \
  -x "help/*.png" -x "assets/store/*"
```

To run the real extension: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`.

**Testing the image-detection path needs a real extension in a real browser** — the preview harness has no service worker, offscreen document, WebGL or `chrome.scripting`. Branded Chrome 153+ dropped `--load-extension`, so use *Chrome for Testing* (`npx @puppeteer/browsers install chrome@<ver>`) driven by `puppeteer-core`: launch with `--disable-extensions-except=<extension/> --load-extension=<extension/> --use-angle=metal --enable-gpu --ignore-gpu-blocklist` (`ignoreDefaultArgs: ['--disable-extensions']`, headless), enable the feature by writing `cancelItSettings.imageDetection.enabled` through the worker or options page, and wait for `chrome.storage.session.cancelItImageStatus.state === 'ready'`. Serve test images from a second localhost origin so they are cross-origin. Two harness gotchas: an attached debugger keeps the service worker alive, so to test worker idle death launch with `targetFilter: (t) => t.type() !== 'service_worker'` and drive everything from an options-page target; and `chrome.runtime.reload()` unloads a command-line-loaded extension rather than reloading it. A reliable deterministic positive that needs no explicit content: the cat-claw photo on Wikipedia's "Cat" article scores Porn ≈ 0.99 (a known model false positive). **Run `qa-fixtures/e2e/suite.js` (~3 min, 69 checks), `lifecycle.js` (~2 min) and `hold.js` (standalone, ~15s) after touching any image-detection code** — setup and env vars are in `qa-fixtures/e2e/README.md`.

**UI preview without loading the extension**: open `qa-fixtures/ui-preview/options-preview.html` or `popup-preview.html` in a browser. They load the real extension JS/CSS with `qa-fixtures/chrome-stub.js` faking `chrome.*` (seeded sample data, async `storage.onChanged` dispatch like real Chrome). This is the primary way UI changes get exercised — drive them with scripted DOM clicks and assert on classlist/state.

**If the sandboxed browser tool's local-file preview misbehaves** (renders unstyled/static, ignores clicks — this has happened across multiple sessions, seemingly tied to the tool's file:// handling rather than anything in this repo): fall back to headless Chrome directly, which has reliably worked every time. Build a self-contained test file with absolute paths to the real `theme.css`/`options.css`/`options.js` etc. (same substitutions as `regen-previews.sh`, but absolute so the file can live anywhere) plus `qa-fixtures/chrome-stub.js` or a patched copy of it for a specific scenario, append a `<script>` that drives the interaction (`element.click()`, `sleep()` via `setTimeout`, assertions written into `document.title`), then run:
```sh
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --hide-scrollbars --window-size=1280,900 \
  --virtual-time-budget=6000 --dump-dom driver.html > out.html   # read assertions back out of <title>
# swap --dump-dom for --screenshot=out.png to eyeball the result instead
```
This drives the actual shipped files, not a reimplementation — used to verify all of Focus Mode (v1) this way, including multi-step flows (add site → start session → PIN-gated end) and visual checks, when the normal preview path wasn't available.

## Architecture

Three surfaces share state through `chrome.storage`. There is also a small background worker whose *only* jobs are image detection (below) — keyword filtering, focus mode, and settings never go through it, and the only messages in the system are image-classify requests and status reports:

- `content.js` — runs on `<all_urls>` at `document_start` (so images can be handled as they load; the keyword pipeline still waits for `DOMContentLoaded`); scans and decorates pages.
- `popup.*` — toolbar popup; instant-saves the `enabled` flag, shows per-page block summary and a focus-session banner.
- `options.*` — full settings page (single HTML with JS-switched sections: overview/blocklist/packs/sites/focus/appearance/family/activity/support, routed via `#hash`).

Storage keys: sync `cancelItSettings` (the entire settings object — blocklist, packs, site rules, `focusMode`, `parentLock`, `shareUsageStats`); local `cancelItStats` (incl. `byDay` daily buckets), `cancelItPageSummaries` (per-URL block counts the popup reads, trimmed to 25), `cancelItAssets` (placeholder image data-URL), `cancelItLockState`, `cancelItAnalyticsClientId`; session `cancelItImageStatus` (image-model state, written only by `background.js`). The built-in `PACKS` catalog is duplicated in `content.js` and `options.js` — keep them in sync. Custom packs get ids `custom_<slug>`.

`content.js` pipeline: `rebuildActiveSettings()` merges blocklist + enabled packs + temp mutes, applies the longest-matching site rule (mode/scope override, `off` disables), and builds per-term regexes with a **word-start boundary** (`(?<![\p{L}\p{N}])` — "crypto" matches "cryptobro" but not "encrypted"). `fullRescan()` clears and re-applies `data-cancel-it-*` attributes; site-specific hide-target heuristics exist for Facebook and LinkedIn. Blur/hide/placeholder are pure CSS keyed off those attributes. Focus mode is checked first, ahead of and independent of the normal keyword pipeline (and of the master `enabled` flag) — `getActiveFocusBlock()` matches `focusMode.blockedSites` against `location.hostname` and, if live, `renderFocusBlock()` swaps in a full-page takeover (`#cancel-it-focus-overlay`, `all:initial` + max z-index to survive hostile page CSS) instead of scanning. A `setInterval` drives the on-page countdown and re-runs `fullRescan()` the moment the session ends, so a tab unblocks itself live with no background worker needed.

`options.js` conventions: all rendering builds DOM via `el()`/`textContent`; state lives in `settingsState`, mutating handlers call `markDirty()`, save/discard/reload call `clearDirty()` + `renderAll()`. **Focus mode is the one exception** — `persistFocusMode()` writes straight to `chrome.storage.sync` (fetch-fresh, merge just the `focusMode` patch, write back — mirrors popup.js's `persistEnabled`) instead of going through the dirty/Save flow, because starting or ending a session is an action, not a draft. `settingsState.focusMode` is kept as a read-only mirror so an unrelated Save doesn't clobber it (`collectSettings()` still round-trips it). Ending an active session is PIN-gated through the same `parentLock` hash used everywhere else when a PIN is set; with no PIN it's a single click, matching how the master toggle behaves unlocked.

**Explicit-image detection** (opt-in, `settings.imageDetection.enabled`, default off; changes via the normal draft + Save flow) spans five files:
- `background.js` (service worker) — on settings change / install / startup it registers or unregisters the hold script (`image-hold.css` + `image-hold.js`, `document_start`, http(s) only, `excludeMatches` from `off` site rules with a no-exclusion fallback if Chrome rejects a pattern), owns the single offscreen document, and relays `cancel-it:classify` from content scripts to it. Everything tears down when the feature or the master toggle goes off. Status (`loading`/`ready`/`unsupported`) is published in `chrome.storage.session.cancelItImageStatus` for the options page.
- `offscreen.html/js` — the only place TF.js runs (a service worker has no WebGL). Re-fetches the image (`credentials:'omit'`, `cache:'no-store'`, 8s timeout, 15MB cap; `data:` raster images are scored straight from the URL), scores it with the bundled NSFWJS MobileNetV2, returns only `{porn, hentai, sexy}`. Two separate limits — 8 concurrent downloads, 3 concurrent scorings — because network delay and GPU work bottleneck differently (a shared limit of 3 measurably let images show unchecked on a slow CDN); in-flight de-dup by URL, in-memory LRU (never persisted). **WebGL only**: on the CPU backend (~2s/image) it reports `unsupported` and the feature opts out.
- `image-hold.css/js` — keep every `<img>` invisible from when it *loads* until verified; the 4s fail-open expiry is pure CSS keyed on `data-cancel-it-loaded`, stamped by `image-hold.js` on `load`/`error` **and** on insertion of an already-complete image (preloaded-then-appended and src-less images fire no load event; without the insertion stamp they would stay invisible forever). These two files are the last line of defence and must stay independent of everything else.
- `content.js` — `syncImages()` is a level-triggered reconcile over `document.images`, called from every `fullRescan()` (in `finally`, so it also runs on the early-return paths: filtering off, site rule off, page-blur, focus session) and from a 40ms debounce when verdicts arrive. It sets `data-cancel-it-verified="<url>"` (ends the hold; a changed `currentSrc` voids it) and `data-cancel-it-explicit` (the blur: `img[data-cancel-it-explicit]` CSS). Flagged images are **always blurred, with no way to reveal them, regardless of the keyword mode** — a deliberate product decision (family use); a hover tooltip on `<html>` just explains why. Verdicts are cached per page by URL because rescans and re-renders are constant and classification is async. Threshold: `porn+hentai ≥ 0.5` or `sexy ≥ 0.8` (`IMAGE_*_THRESHOLD` constants, measured: on 621 ordinary Wikipedia/Commons pictures, deliberately heavy on swimwear and beaches, this wrongly blurs 6.6%; 0.6/0.9 was 4.5%; lower bars start catching cats and paintings — `sexy` also fires on swimwear).
- `options.*` — toggle + status line in Filtering style.

Known limits (state them if asked): only `<img>` in the top document (not CSS backgrounds, `<video>`, canvas, iframes, shadow DOM); `blob:`/SVG/<64px images and `data:` images over 1.5MB aren't checked; cookie- or referrer-gated images fail to re-download and are shown (fail-open); the model has a real false-positive rate on ordinary photos (wrongly blurred pictures cannot be revealed; the escape hatch is a per-site Off rule or switching the feature off) and its recall on explicit material is unmeasured by tests here (no such test data was used; the owner reported by hand that real explicit pictures were mostly blurred at 0.6/0.9 and asked for the modest step to 0.5/0.8).

Analytics (`analytics.js`) is GA4 Measurement Protocol via plain `fetch` — never a remote SDK (MV3 remote-code rule, and the store answers certify "no remote code"). It is double-gated: inert unless `apiSecret` is set in `firebase-config.js` AND the user opted into `shareUsageStats` (Support-section toggle, default off).

## Invariants — do not break these

- **Never** render user/page-derived strings via `innerHTML` (past XSS bug; everything uses `textContent`).
- **Ship `vendor/tf.es2017.min.js`, never `tf.min.js`.** The default bundle calls `Function("return this")()` at load, which MV3's CSP forbids (`tf.ready is not a function`). No remote code: model and runtime are bundled.
- **Every `<img>` must end up released** (`data-cancel-it-verified` or the `<html>` `data-cancel-it-image-release` flag) on every path — skipped/broken/tiny/SVG/`data:` images, feature off, site rule off, focus session, unsupported GPU. An image that is never released stays invisible. Keep the fail-open: a failed or slow check shows the image.
- **The verified marker is tied to the URL it verified** (`imageKey(img)` = `currentSrc`); never mark an image before it has a `currentSrc`, and clear the marker when the URL changes (the `src`/`srcset` MutationObserver does this before the new picture can paint).
- **The `data-cancel-it-*` image attributes are outside the main observer's `attributeFilter` on purpose.** Never write `title`/`alt`/`aria-label`/`src` from the image code: they are in the filter (would trigger rescans) and are also scanned as keyword text — a label like "explicit" would match the Adult Content pack against our own UI. The hover hint lives on `<html>`, outside the observed `<body>`, for the same reason.
- **Only trust a `data-cancel-it-verified` marker on an element in the `imageSettled` WeakSet** — pages (or restored saved HTML) can carry a copy of the attribute.
- **Re-downloads use `cache:'no-store'` and `credentials:'omit'`**: the privacy policy promises pictures are analysed in memory and forgotten; without `no-store` Chrome keeps a disk-cache copy.
- **Do not change the offscreen preprocessing without re-measuring false positives**: full-image `resizeBilinear(224, alignCorners)` matches NSFWJS; a smoother `createImageBitmap` resize measurably pushed ordinary photos toward "porn".
- **Message handlers authenticate senders**: `classify` only from content scripts (`sender.tab` *and* an http(s) `sender.url` — extension pages open in a tab also have `sender.tab`); offscreen accepts only `target:"offscreen"` messages without a tab; the worker accepts status/reset only from the offscreen document's URL.
- **Analytics stays booleans-only for this feature** (`image_detection_enabled`) — never image URLs, hosts, verdicts or scores.
- **Never** let `content.js`'s MutationObserver see its own DOM edits: `fullRescan()` must `disconnect()` before mutating and re-observe in `finally` (past infinite-rescan bug).
- **Dirty tracking is an explicit flag** — do not reintroduce serialize-and-compare dirty detection (it broke against `chrome.storage` round-trips).
- **Analytics may never contain**: the main blocklist, temp mutes, page text, URLs/hostnames, or PINs. Pack names and pack-added keywords ARE collected (deliberate decision, v0.2.3) and this is disclosed in the consent toggle copy — if event content changes, the toggle copy, the Support privacy footnote, and `STORE_LISTING.md` must change with it.
- PIN lock: `relockMinutes: 0` means "relock on save"; unlock always grants a real window (10 min) — an `unlockedUntil` in the past means locked (past hard-lockout bug).
- PINs are stored only as `sha256(salt:pin)`; treat the lock as a speed bump, not security.

## Store publishing

`STORE_LISTING.md` holds the copy-paste answers for the dashboard's Privacy practices tab (justifications for activeTab/host/storage, single-purpose text, data-usage declarations per version). The image-detection version adds permissions `offscreen`, `scripting` and explicit `host_permissions` plus a service worker — justification text is in `STORE_LISTING.md`. The zip grows by ~2.3MB compressed (TF.js + model), all of it needed; the store zip must include `vendor/` and `models/`. Versions shipping analytics require declaring "User activity" (+ PII since v0.2.3) and a hosted privacy policy URL. The packaged zip deliberately excludes `icons/` (legacy, unreferenced), `previews/`, `help/*.png` (the modal uses the compressed `.webp` files), and `PRIVACY.html`.

The privacy policy is hosted via GitHub Pages at `https://umarchohan.github.io/cancel_it/privacy.html`, served from `docs/privacy.html` (Pages source: main branch, `/docs`). `docs/privacy.html` is a manual copy of `extension/PRIVACY.html` — **update both** when data practices change, then push `docs/` so the live URL reflects it before resubmitting to the store. A prior submission was rejected (link didn't resolve to an actual policy) because this hosting step was skipped.

## Design & assets

The UI implements the Claude Design project `fecb1218-031d-4a7e-8579-558f0cdb5efb` ("Cancel It.dc.html", teal/paper theme). All tokens live in `extension/theme.css` — style new UI from those variables, not hardcoded colors. Fonts: `extension/fonts/Sora-Variable.woff2` and `PublicSans-Variable.woff2` are the latin-subset variable fonts pulled from Google Fonts (self-hosted — never load fonts from a CDN at runtime, that's a privacy promise; re-fetching them is just `curl` against `fonts.googleapis.com/css2?family=...` with a Chrome user-agent to get the woff2 URL). Logo source lives in `design-assets/brand/` (cream background, no alpha); manifest icons are `assets/brand/icon-*.png`, and the in-page header mark `assets/in-app/logo-mark.png` is a flood-fill transparent cutout of `cancel-it-logo-v2.png` — regenerate it the same way if the logo changes.

`extension/help/*.webp` (used by the options-page help modal, `HELP_CONTENT` in `options.js`) are flat illustrations styled directly from `theme.css`'s real tokens/components (not photos or AI-generated art) — source markup for regenerating them lives only as scratch files during editing sessions, not checked into the repo; rebuild by authoring plain HTML against the theme tokens and rendering with headless Chrome (`--headless --window-size=1280,800 --screenshot=out.png file://...`), then compressing to `.webp` at quality ~82. The matching `.png` files alongside them are just uncompressed references, excluded from the store zip.

`marquee.png` (1400×560) and `small-tile.png` (440×280) at the repo root are the Chrome Web Store promotional images (Store Listing tab → promo assets) — built the same way as the help illustrations (real theme tokens, headless Chrome, saved as PNG since the dashboard doesn't accept WebP for these). The old pre-redesign `Generated image 1/2/3.png` (dark/orange brand, mismatched feature names) have been removed.
