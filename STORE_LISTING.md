# Cancel It Store Listing

## Tagline

Hide what you never want to see.

## Short description

Blur, hide, or replace blocked names and keywords across the sites you browse.

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

Current version focuses on keyword and text-context filtering.

What this extension does not do:

- no face recognition
- no pixel-level image classification
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
- Website content: Processes visible page text and image metadata locally to apply user filters

## Privacy practices tab — copy-paste answers (v0.2.0)

### Single purpose description

> Cancel It lets users hide, blur, or replace words, names, and topics they choose (a personal blocklist plus optional keyword packs) on the webpages they visit. All page scanning happens locally in the browser; nothing is uploaded.

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
- **Versions ≥0.2.3**: opted-in analytics additionally includes user-entered pack content (custom pack names and keywords added to packs, with event timestamps). Because users can type personal terms (including people's names) there, ALSO check **Personally identifiable information** to be safe, and state explicitly in the privacy policy that pack names/keywords are collected when usage sharing is on. The user's main blocklist is still never collected.
- Tick all three certification checkboxes (no sale of data, no use unrelated to single purpose, no use for creditworthiness) and the developer programme policies certification.

### Listing form

- Language: **English**
- Category: **Well-being** (alternative: Tools)

## Reviewer notes

- Open extension options page
- Add `Jennifer Lopez` as blocked term
- Visit any page containing that text
- Confirm only matching references are blurred/hidden/replaced according to selected mode
