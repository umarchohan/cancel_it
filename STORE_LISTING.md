# Cancel It Store Listing

## Tagline

Hide what you never want to see.

## Short description

Filter names, topics and explicit images, block distracting sites, and calm social media. Everything stays on your device.

## Full description

Cancel It helps you filter unwanted names, phrases, and topics from the pages you visit.

Add any blocked term in the options page, choose how matches should appear, and the extension will
scan visible page text plus image metadata to reduce unwanted references while keeping the rest of
the page readable.

Use Cancel It to:

- hide celebrity names or topics you are tired of seeing
- blur unwanted references instead of removing entire posts
- replace blocked matches with a neutral placeholder
- keep your filter list synced in your Chrome profile
- start a timed Focus session that blocks the distracting sites you choose (ending it needs your Family PIN if you set one)
- turn social media black & white, so endless scrolling is less tempting
- use YouTube for search only: no home feed, no recommended videos, no autoplay
- hide YouTube Shorts, Instagram Reels and Facebook Reels
- optionally blur sexually explicit pictures automatically (off by default; a small AI model runs
  on your device and nothing is uploaded)

Keyword and text-context filtering is the core of the extension. Explicit-image detection is an
opt-in extra (added in 0.3.0), as is Focus Mode (also new in 0.3.0; it needs no new permissions and stores only the site list you type).

What this extension does not do:

- no face recognition
- no uploading of images or page content — image checking, when you turn it on, runs entirely on your device
- no external account required
- no subscription required

## Suggested category

Productivity

## Suggested tags

- content filter
- keyword blocker
- browsing cleanup
- distraction blocker
- privacy friendly

## Privacy disclosures draft

- Personal communications: No
- Health information: No
- Financial and payment information: No
- Authentication information: No
- Personal identifiable information: No
- Location: No
- Web history: Processes page content locally to apply user filters; does not transmit externally
- User activity: Processes visible page content locally to apply user filters; does not transmit externally
- Website content: Processes visible page text and image metadata locally to apply user filters; if the user opts in to explicit-image detection, also analyses the pictures themselves locally with a bundled model (re-downloaded from their source, analysed in memory, discarded; never transmitted)

## Privacy practices tab — copy-paste answers (v0.2.0)

### Single purpose description

> Cancel It reduces unwanted and distracting content on the webpages a user visits: it hides, blurs, or replaces words, names, and topics they choose (and, optionally, explicit images), blocks distracting sites during a timed focus session, and makes social media less compulsive (black & white mode, YouTube without recommendations, no short-video feeds). Everything runs locally in the browser; nothing is uploaded.

(Rewritten for the Social media version. The store enforces a *single* purpose; every feature is framed as one purpose — less unwanted and distracting content — rather than a list of tools. If a reviewer still objects, the fallback is to split Focus/Social media into a separate extension.)

### activeTab justification

> The toolbar popup uses activeTab, granted only when the user clicks the extension icon, to read the current tab's URL so it can show which site the user is on, how many items were filtered on that page, and which of the user's rules caused it. The URL is used only for this display and for the user's own per-site filtering rules; it is never transmitted off the device.

### Host permission justification (content script on all sites)

> The extension's single purpose is to hide, blur, or replace user-chosen words and topics on any page the user visits. To do this, the content script must run on all sites to scan visible page text and image metadata locally against the user's blocklist and apply the chosen visual treatment. Filtering cannot work on a site the script cannot read. All matching happens on the user's device; no page content, URLs, or keywords are ever sent to any server.

### storage justification

> chrome.storage.sync stores the user's own settings: blocklist terms, enabled keyword packs, per-site rules, display preferences, and the salted hash of the optional family-controls PIN (never the PIN itself). chrome.storage.local stores local-only filtering statistics (counts of blocked items), the user's optional custom placeholder image, and the temporary unlock state. All of this exists solely to provide the extension's functionality and never leaves the user's browser profile apart from Chrome's own settings sync.

### Remote code use

Select: **No, I am not using remote code.** (All JavaScript is bundled in the package. No CDN scripts, no eval, no remotely fetched code. If the form insists on a text justification, enter: "This extension does not execute remote code. All scripts ship inside the package.")

### Data usage section

- **Versions ≤0.2.1 (no analytics)**: check **none** of the data-collection categories — the extension does not collect or transmit any user data. Page content is read and discarded in-memory on the user's device; settings and stats stay in browser storage.
- **Versions ≥0.2.2 (opt-in GA4 analytics shipped)**: check **User activity** (feature-usage events such as which filtering style is selected — sent only if the user turns on "Share anonymous usage stats", which is off by default; contains no page text, URLs, or PINs). A hosted **privacy policy URL** becomes required — host PRIVACY.html (e.g. GitHub Pages) and update it to describe the opt-in analytics before submitting.
- **Privacy policy URL field on the dashboard**: use `https://umarchohan.github.io/cancel_it/privacy.html` (source: `docs/privacy.html`, mirrors `extension/PRIVACY.html` — keep both in sync when the policy changes). This was rejected once ("Purple Nickel" — link didn't lead to a valid privacy policy) because no page was actually hosted at submission time; fixed 2026-07-21 by publishing via GitHub Pages. Verify the URL loads the actual policy text (not a redirect or 404) before resubmitting.
- **Versions ≥0.2.3**: opted-in analytics additionally includes user-entered pack content (custom pack names and keywords added to packs, with event timestamps). Because users can type personal terms (including people's names) there, ALSO check **Personally identifiable information** to be safe, and state explicitly in the privacy policy that pack names/keywords are collected when usage sharing is on. The user's main blocklist is still never collected.
- Tick all three certification checkboxes (no sale of data, no use unrelated to single purpose, no use for creditworthiness) and the developer programme policies certification.

### Listing form

- Language: **English**
- Category: **Well-being** (alternative: Tools)

## Privacy practices tab — additions for the image-detection version (0.3.0)

New permissions this version adds: `offscreen`, `scripting`, and an explicit `host_permissions: <all_urls>` (which the all-sites content script already implied — install warnings are unchanged, checked with `chrome.management.getPermissionWarningsByManifest`). The extension also gains a background service worker.

### offscreen justification (reason: BLOBS)

> Explicit-image detection is an optional feature (off by default). To run its bundled machine-learning model on the user's graphics chip, the extension needs a DOM/WebGL context, which a service worker does not have. It creates one offscreen document, only while the feature is on, that downloads a picture as a blob, decodes it, scores it with the model, and answers "explicit or not". The model and its runtime ship inside the package; the offscreen document loads no remote code and sends nothing off the device.

### scripting justification

> Used only to register, while explicit-image detection is on, a tiny document_start content script + stylesheet that keeps a picture invisible from the moment it loads until it has been checked, so nothing flashes on screen unfiltered. It is unregistered as soon as the feature is turned off. The stylesheet also expires by itself after 4 seconds, so a slow check can never leave a page with missing pictures.

For builds after 0.3.0 (open-tab repair + Social media), use this full scripting justification instead:

> Used for three things, each only with the extension's own bundled files: (1) while explicit-image detection is on, it registers a tiny document_start script + stylesheet that keeps a picture invisible from the moment it loads until it has been checked (unregistered when the feature is off; the stylesheet also expires by itself after 4 seconds, so a slow check can never leave a page with missing pictures); (2) while black & white mode is on, it registers a one-line stylesheet for the user's own list of social sites so they don't flash in colour before turning grey (unregistered when the mode is off); (3) once, right after the extension is installed or updated, it adds the extension's own content script to tabs that were already open (Chrome does not do this itself), so filtering and focus sessions work without refreshing every tab.

### Host permission justification — addition

> If the user turns on explicit-image detection, the extension re-downloads each picture on the page from its own source (without cookies) so the on-device model can analyse it; pictures are frequently hosted on other domains than the page, so this needs access to all sites, and the content script already runs on all sites. Nothing is uploaded.

### Remote code use — unchanged (No)

TensorFlow.js (`vendor/tf.es2017.min.js`, Apache-2.0) and the model weights (`models/nsfw/`, MIT, from NSFWJS/GantMan) are bundled in the package and licences are in `vendor/THIRD_PARTY_LICENSES.txt`. The ES2017 build is used deliberately: the default `tf.min.js` calls `Function()` at load, which Manifest V3's CSP forbids. Nothing is fetched or evaluated at runtime.

### Data usage section — unchanged categories

Images are analysed locally and never transmitted, so no new data-collection category applies. The opt-in GA4 events gain one boolean (`image_detection_enabled`); the toggle copy already says "which features are used". Privacy policy updated in both copies (`extension/PRIVACY.html`, `docs/privacy.html`) — push `docs/` before submitting.

## Reviewer notes

- Open extension options page
- Add `Jennifer Lopez` as blocked term
- Visit any page containing that text
- Confirm only matching references are blurred/hidden/replaced according to selected mode

Explicit-image detection (optional, off by default):

- Options → Filtering style → "Explicit images" → turn on "Detect explicit images automatically" → Save
- The status line under the switch should read "Ready" after a few seconds (it needs WebGL; on machines without it the line says "Not available" and pictures are shown normally)
- Browse any image-heavy page (e.g. a Wikipedia article): pictures appear normally; anything the model flags is blurred and stays blurred (hovering it explains why). The model is imperfect, so on a normal page a few harmless pictures may get blurred (e.g. the cat-claw photo on Wikipedia's "Cat" article). No explicit test content is needed or supplied.
