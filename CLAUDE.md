# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cancel It — a Manifest V3 Chrome extension that hides, blurs, or replaces user-chosen keywords on webpages. Vanilla JS/CSS/HTML in `extension/`; no build step, no package manager, no test framework.

## Commands

```sh
# Syntax-check after JS edits (only automated check available)
node --check extension/options.js extension/popup.js extension/content.js extension/analytics.js

# Regenerate the browser preview pages after editing options.html or popup.html
./qa-fixtures/regen-previews.sh

# Build the Chrome Web Store package (bump "version" in manifest.json FIRST —
# the dashboard rejects a version it has already seen)
cd extension && zip -r ../dist/cancel-it-<version>.zip . \
  -x "icons/*" -x "previews/*" -x "PRIVACY.html" -x "*.DS_Store" \
  -x "help/*.png" -x "assets/store/*"
```

To run the real extension: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`.

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

Three surfaces share state exclusively through `chrome.storage` (there is **no background service worker** and no messaging):

- `content.js` — runs on `<all_urls>`; scans and decorates pages.
- `popup.*` — toolbar popup; instant-saves the `enabled` flag, shows per-page block summary and a focus-session banner.
- `options.*` — full settings page (single HTML with JS-switched sections: overview/blocklist/packs/sites/focus/appearance/family/activity/support, routed via `#hash`).

Storage keys: sync `cancelItSettings` (the entire settings object — blocklist, packs, site rules, `focusMode`, `parentLock`, `shareUsageStats`); local `cancelItStats` (incl. `byDay` daily buckets), `cancelItPageSummaries` (per-URL block counts the popup reads, trimmed to 25), `cancelItAssets` (placeholder image data-URL), `cancelItLockState`, `cancelItAnalyticsClientId`. The built-in `PACKS` catalog is duplicated in `content.js` and `options.js` — keep them in sync. Custom packs get ids `custom_<slug>`.

`content.js` pipeline: `rebuildActiveSettings()` merges blocklist + enabled packs + temp mutes, applies the longest-matching site rule (mode/scope override, `off` disables), and builds per-term regexes with a **word-start boundary** (`(?<![\p{L}\p{N}])` — "crypto" matches "cryptobro" but not "encrypted"). `fullRescan()` clears and re-applies `data-cancel-it-*` attributes; site-specific hide-target heuristics exist for Facebook and LinkedIn. Blur/hide/placeholder are pure CSS keyed off those attributes. Focus mode is checked first, ahead of and independent of the normal keyword pipeline (and of the master `enabled` flag) — `getActiveFocusBlock()` matches `focusMode.blockedSites` against `location.hostname` and, if live, `renderFocusBlock()` swaps in a full-page takeover (`#cancel-it-focus-overlay`, `all:initial` + max z-index to survive hostile page CSS) instead of scanning. A `setInterval` drives the on-page countdown and re-runs `fullRescan()` the moment the session ends, so a tab unblocks itself live with no background worker needed.

`options.js` conventions: all rendering builds DOM via `el()`/`textContent`; state lives in `settingsState`, mutating handlers call `markDirty()`, save/discard/reload call `clearDirty()` + `renderAll()`. **Focus mode is the one exception** — `persistFocusMode()` writes straight to `chrome.storage.sync` (fetch-fresh, merge just the `focusMode` patch, write back — mirrors popup.js's `persistEnabled`) instead of going through the dirty/Save flow, because starting or ending a session is an action, not a draft. `settingsState.focusMode` is kept as a read-only mirror so an unrelated Save doesn't clobber it (`collectSettings()` still round-trips it). Ending an active session is PIN-gated through the same `parentLock` hash used everywhere else when a PIN is set; with no PIN it's a single click, matching how the master toggle behaves unlocked.

Analytics (`analytics.js`) is GA4 Measurement Protocol via plain `fetch` — never a remote SDK (MV3 remote-code rule, and the store answers certify "no remote code"). It is double-gated: inert unless `apiSecret` is set in `firebase-config.js` AND the user opted into `shareUsageStats` (Support-section toggle, default off).

## Invariants — do not break these

- **Never** render user/page-derived strings via `innerHTML` (past XSS bug; everything uses `textContent`).
- **Never** let `content.js`'s MutationObserver see its own DOM edits: `fullRescan()` must `disconnect()` before mutating and re-observe in `finally` (past infinite-rescan bug).
- **Dirty tracking is an explicit flag** — do not reintroduce serialize-and-compare dirty detection (it broke against `chrome.storage` round-trips).
- **Analytics may never contain**: the main blocklist, temp mutes, page text, URLs/hostnames, or PINs. Pack names and pack-added keywords ARE collected (deliberate decision, v0.2.3) and this is disclosed in the consent toggle copy — if event content changes, the toggle copy, the Support privacy footnote, and `STORE_LISTING.md` must change with it.
- PIN lock: `relockMinutes: 0` means "relock on save"; unlock always grants a real window (10 min) — an `unlockedUntil` in the past means locked (past hard-lockout bug).
- PINs are stored only as `sha256(salt:pin)`; treat the lock as a speed bump, not security.

## Store publishing

`STORE_LISTING.md` holds the copy-paste answers for the dashboard's Privacy practices tab (justifications for activeTab/host/storage, single-purpose text, data-usage declarations per version). Versions shipping analytics require declaring "User activity" (+ PII since v0.2.3) and a hosted privacy policy URL. The packaged zip deliberately excludes `icons/` (legacy, unreferenced), `previews/`, `help/*.png` (the modal uses the compressed `.webp` files), and `PRIVACY.html`.

The privacy policy is hosted via GitHub Pages at `https://umarchohan.github.io/cancel_it/privacy.html`, served from `docs/privacy.html` (Pages source: main branch, `/docs`). `docs/privacy.html` is a manual copy of `extension/PRIVACY.html` — **update both** when data practices change, then push `docs/` so the live URL reflects it before resubmitting to the store. A prior submission was rejected (link didn't resolve to an actual policy) because this hosting step was skipped.

## Design & assets

The UI implements the Claude Design project `fecb1218-031d-4a7e-8579-558f0cdb5efb` ("Cancel It.dc.html", teal/paper theme). All tokens live in `extension/theme.css` — style new UI from those variables, not hardcoded colors. Fonts: `extension/fonts/Sora-Variable.woff2` and `PublicSans-Variable.woff2` are the latin-subset variable fonts pulled from Google Fonts (self-hosted — never load fonts from a CDN at runtime, that's a privacy promise; re-fetching them is just `curl` against `fonts.googleapis.com/css2?family=...` with a Chrome user-agent to get the woff2 URL). Logo source lives in `design-assets/brand/` (cream background, no alpha); manifest icons are `assets/brand/icon-*.png`, and the in-page header mark `assets/in-app/logo-mark.png` is a flood-fill transparent cutout of `cancel-it-logo-v2.png` — regenerate it the same way if the logo changes.

`extension/help/*.webp` (used by the options-page help modal, `HELP_CONTENT` in `options.js`) are flat illustrations styled directly from `theme.css`'s real tokens/components (not photos or AI-generated art) — source markup for regenerating them lives only as scratch files during editing sessions, not checked into the repo; rebuild by authoring plain HTML against the theme tokens and rendering with headless Chrome (`--headless --window-size=1280,800 --screenshot=out.png file://...`), then compressing to `.webp` at quality ~82. The matching `.png` files alongside them are just uncompressed references, excluded from the store zip.

`marquee.png` (1400×560) and `small-tile.png` (440×280) at the repo root are the Chrome Web Store promotional images (Store Listing tab → promo assets) — built the same way as the help illustrations (real theme tokens, headless Chrome, saved as PNG since the dashboard doesn't accept WebP for these). The old pre-redesign `Generated image 1/2/3.png` (dark/orange brand, mismatched feature names) have been removed.
