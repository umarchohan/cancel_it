# Cancel It

Chrome extension that hides, blurs, or masks blocked names and keywords across websites.

## Current v1 scope

- Manifest V3 extension
- Blocklist stored in Chrome sync storage
- Scans visible text and image metadata on pages you visit
- Supports `blur`, `hide`, and `placeholder` modes
- Re-scans dynamic pages with a mutation observer

## Load in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `/Users/umarafzal/Documents/cancel_it/extension`

## Configure

1. Open extension details page
2. Click `Extension options`
3. Add one blocked term per line
4. Choose blur, hide, or placeholder mode

## Known limits

- Blocks by text/context. No face recognition or pixel-level celebrity detection.
- Broad DOM scanning can still miss edge-case layouts or over-block noisy pages.
- Some infinite-scroll apps may need site-specific tuning later.
