# Real-extension end-to-end suites (image detection)

The `ui-preview` harness can't exercise explicit-image detection: it has no service worker,
offscreen document, WebGL or `chrome.scripting`. These suites load the **real `extension/` folder**
into Chrome for Testing and drive it with `puppeteer-core`. Dev tooling only — nothing here ships
in the store zip (which is built from `extension/`).

## Setup (once)

Branded Chrome 153+ ignores `--load-extension`, so use Chrome for Testing:

```sh
mkdir -p /tmp/cancel-it-e2e && cd /tmp/cancel-it-e2e
npm init -y >/dev/null && npm i --no-fund --no-audit puppeteer-core @puppeteer/browsers
npx @puppeteer/browsers install chrome@stable      # prints the binary path
```

## Run

```sh
export PUPPETEER_CORE_PATH=/tmp/cancel-it-e2e/node_modules/puppeteer-core
export CHROME_FOR_TESTING="<path printed above>/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
node qa-fixtures/e2e/suite.js        # ~3 min, 88 checks: hold/blur/no-reveal/src swap/fail-open/burst/data: URLs/off switches/options/popup
node qa-fixtures/e2e/social-live.js  # ~4 min, LIVE sites (internet): black & white, YouTube search-only, Shorts/Reels
                                     # breaks when YouTube/Instagram/Facebook change their pages; logged out only
node qa-fixtures/e2e/stale-tab.js    # ~20s: tab open across an extension reload gets repaired (helper extension does the reload)
node qa-fixtures/e2e/hold.js         # ~15s: image-hold.css+js alone, no extension (the never-stuck-hidden guarantee)
node qa-fixtures/e2e/lifecycle.js    # ~2 min: no-GPU device, 30s worker idle death, extension vanishing
```

- macOS GPU flags are in `GPU` in `lib.js` (`--use-angle=metal`); adjust for other platforms. WebGL must
  work or the model correctly reports "unsupported" and the feature opts out.
- Test pictures are generated in `lib.js` (neutral gradients). The one *positive* needs no explicit content:
  Wikipedia's cat-claw photo scores Porn ≈ 0.99 with this model (a known false positive). It is downloaded
  once to the OS temp dir; set `FLAGGED_IMAGE=/path/to.jpg` to use a local file instead (offline, or if the
  URL moves). If the model or preprocessing changes and that image stops flagging, pick another positive.
- Images are served from `localhost:8802`, pages from `localhost:8801`, so images are cross-origin.
- The worker is deliberately **not** attached to the debugger (`attachWorker: false`): an attached
  debugger keeps an MV3 worker alive, hiding lifecycle bugs. Everything is driven through an options-page target.
