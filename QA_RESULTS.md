# Cancel It QA Results

Date: 2026-05-15

## Environment
- Extension source: `/Users/umarafzal/Documents/cancel_it/extension`
- Fixture page: `http://127.0.0.1:8123/test-page.html`
- Browser testing:
  - Chrome plugin for deterministic content-filter checks on the fixture page
  - Google Chrome + Computer Use for options, popup, PIN, and relock behavior

## What Passed

### Filter modes
- `Blur references`
  - `Jennifer Lopez` inline text was blurred
  - matching card content was blurred
  - matching image metadata fixture was blurred
- `Use placeholder`
  - inline text changed to placeholder treatment
  - card content changed to placeholder treatment
  - matching image metadata fixture changed to placeholder treatment
- `Hide references` + `Whole block`
  - celebrity inline block was removed
  - celebrity card block was removed

### Packs
- `Celebrity Gossip`
  - blocked `Jennifer Lopez`
- `Politics`
  - blocked `politics`
- `Crypto Hype`
  - blocked `crypto`
- `Sports Spoilers`
  - blocked `final score`
- `Adult Content`
  - blocked `porn`
- `Family Safe`
  - blocked `gore`
  - also blocked `porn`
- `Ragebait`
  - blocked `you won't believe`

### PIN flow
- turning PIN protection on disabled save until PIN was valid
- short PIN stayed blocked
- mismatched confirmation stayed blocked
- valid `1234 / 1234` enabled save
- saving PIN protection succeeded

### Timer / relock
- `Unlock for 1 minute`
  - save feedback correctly said the extension would relock in 1 minute
  - settings page relocked automatically after the timeout
- `Lock immediately after save`
  - save feedback correctly said the extension locked immediately
  - settings page relocked immediately

### Popup lock
- popup page showed lock gate while extension was locked
- correct PIN unlocked popup controls
- popup unlock reopened settings editing during the active unlock window

## Limitations / Brutal Truth
- These passes are strong for deterministic regression coverage because the fixture page is controlled.
- This does **not** prove every live website DOM is fully covered.
- Earlier live Google testing showed the extension was materially better than before, but still not perfect:
  - some `Jennifer Lopez` surfaces were blocked
  - some Google knowledge-panel or result text still leaked
- So:
  - fixture QA: pass
  - settings / popup / PIN / relock: pass
  - live Google full-person-erasure guarantee: fail

## Recommended Next Regression Gate
Before calling this fully production-safe, keep re-running:
- fixture mode checks
- all pack checks
- PIN validation
- timed relock
- immediate relock
- popup lock
- one live Google query
- one X/Twitter post-card case
