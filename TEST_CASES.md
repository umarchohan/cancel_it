# Cancel It Test Cases

## Scope
Manual end-to-end QA for the Chrome extension UI, settings behavior, popup behavior, lock flow, and on-page filtering.

## Preconditions
- Chrome extension is loaded from `/Users/umarafzal/Documents/cancel_it/extension`
- Extension has been reloaded after latest code changes
- Options page opens successfully
- Popup opens successfully

## Test Matrix

### Core settings

1. Filtering toggle persists
- Steps:
  - Open options
  - Turn `Filtering enabled` off
  - Save
  - Reload options
- Expected:
  - Toggle stays off after reload

2. Save appears on basic setting change
- Steps:
  - Open options
  - Change filter mode
- Expected:
  - Save control appears immediately

3. Save success feedback is visible
- Steps:
  - Change any setting
  - Click `Save settings`
- Expected:
  - Save button changes to `Saved`
  - Success text is shown briefly

### Blocklist

4. Blocked terms persist
- Steps:
  - Add a new blocked term in the textarea
  - Save
  - Reload options
- Expected:
  - The new blocked term is still present

5. Matching term is filtered on page
- Steps:
  - Add a known term like `Jennifer Lopez`
  - Save
  - Open a page containing the term
- Expected:
  - Matching content is affected according to selected mode and scope

6. Browser text blocking works in blur mode
- Steps:
  - Set mode to `Blur references`
  - Set scope to `Inline only`
  - Add blocked term `Jennifer Lopez`
  - Save
  - Open a page that visibly contains `Jennifer Lopez`
- Expected:
  - The matching visible text is blurred
  - Surrounding page content remains visible
  - The page is still readable outside the matched reference

7. Browser text blocking works in hide mode
- Steps:
  - Set mode to `Hide references`
  - Add blocked term `Jennifer Lopez`
  - Save
  - Open a page that visibly contains `Jennifer Lopez`
- Expected:
  - The matching reference is hidden
  - On feed/card layouts, the enclosing block may be removed when whole-block logic applies

8. Browser placeholder mode works
- Steps:
  - Set mode to `Use placeholder`
  - Add blocked term `Jennifer Lopez`
  - Save
  - Open a page that visibly contains the term or matching image metadata
- Expected:
  - Blocked area is replaced with placeholder treatment
  - Default placeholder is used when no custom placeholder image is uploaded

9. Browser complete hide works in whole-block scope
- Steps:
  - Set mode to `Hide references`
  - Set scope to `Whole block`
  - Add blocked term `Jennifer Lopez`
  - Save
  - Open a page with cards, posts, or article blocks containing the term
- Expected:
  - The enclosing card, post, or article block is removed from view
  - The blocked block does not leave the matched reference visible

10. Browser whole-block scope works
- Steps:
  - Set scope to `Whole block`
  - Set mode to `Hide references`
  - Add blocked term present in a social post or card
  - Save
  - Open matching page
- Expected:
  - The enclosing post/card/article is hidden, not just the exact word

11. Browser site rule override works
- Steps:
  - Add blocked term `Jennifer Lopez`
  - Add site rule for current test domain with mode `off`
  - Save
  - Open matching page on that domain
- Expected:
  - Content is not blocked on that domain

12. Browser page-blur mode works
- Steps:
  - Set mode to `Blur entire page`
  - Add a blocked term present on the page
  - Save
  - Open matching page
- Expected:
  - Entire page is blurred after the blocked term is detected

13. Browser dynamic-page filtering works
- Steps:
  - Add blocked term `Jennifer Lopez`
  - Save
  - Open an infinite-scroll or dynamically updating page
- Expected:
  - Newly inserted matching content is also filtered after page load

14. Browser filtering disabled state works
- Steps:
  - Add blocked term `Jennifer Lopez`
  - Turn `Filtering enabled` off
  - Save
  - Open matching page
- Expected:
  - Content is not blocked while filtering is disabled

### Packs

15. Celebrity Gossip pack blocks celebrity chatter
- Steps:
  - Enable `Celebrity Gossip`
  - Save
  - Open a page containing `Jennifer Lopez` or another celebrity-gossip term
- Expected:
  - Matching celebrity-gossip references are filtered

16. Politics pack blocks political chatter
- Steps:
  - Enable `Politics`
  - Save
  - Open a page containing terms like `election` or `campaign`
- Expected:
  - Matching political references are filtered

17. Crypto Hype pack blocks crypto chatter
- Steps:
  - Enable `Crypto Hype`
  - Save
  - Open a page containing terms like `bitcoin`, `crypto`, or `nft`
- Expected:
  - Matching crypto-hype references are filtered

18. Sports Spoilers pack blocks spoiler chatter
- Steps:
  - Enable `Sports Spoilers`
  - Save
  - Open a page containing terms like `final score` or `game recap`
- Expected:
  - Matching spoiler references are filtered

19. Adult Content pack blocks explicit chatter
- Steps:
  - Enable `Adult Content`
  - Save
  - Open a page containing terms like `porn` or `explicit`
- Expected:
  - Matching adult-content references are filtered

20. Family Safe pack blocks family-safe terms
- Steps:
  - Enable `Family Safe`
  - Save
  - Open a page containing terms like `porn`, `gore`, or `violent`
- Expected:
  - Matching family-safe references are filtered

21. Ragebait pack blocks engagement-bait chatter
- Steps:
  - Enable `Ragebait`
  - Save
  - Open a page containing terms like `meltdown`, `destroyed`, or `viral outrage`
- Expected:
  - Matching ragebait references are filtered

22. Pack custom term is applied on top of built-in pack terms
- Steps:
  - Select any pack
  - Add a custom pack term
  - Save
  - Open a page containing the custom pack term
- Expected:
  - The custom pack term is filtered
  - Built-in pack terms still work

### Parent lock

23. Save stays disabled with incomplete PIN setup
- Steps:
  - Turn on `Require PIN for settings changes`
  - Do not enter a PIN
- Expected:
  - Save action stays disabled

24. Save stays disabled with invalid PIN
- Steps:
  - Turn on PIN lock
  - Enter `123`
  - Enter `123`
- Expected:
  - Save action stays disabled
  - Reason is PIN length rule

25. Save stays disabled with mismatched confirmation
- Steps:
  - Turn on PIN lock
  - Enter `1234`
  - Enter `1235`
- Expected:
  - Save action stays disabled

26. Save enables with valid PIN setup
- Steps:
  - Turn on PIN lock
  - Enter `1234`
  - Enter `1234`
- Expected:
  - Save action becomes enabled

27. Turning PIN lock off clears draft PIN fields
- Steps:
  - Turn on PIN lock
  - Type values in both PIN inputs
  - Turn PIN lock off before saving
- Expected:
  - PIN fields clear immediately

28. Saved PIN lock blocks settings editing
- Steps:
  - Turn on PIN lock with valid PIN
  - Save
  - Wait for immediate relock or reload options
- Expected:
  - Settings become locked
  - Unlock screen appears

29. Unlock with correct PIN works
- Steps:
  - Enter correct PIN in lock screen
- Expected:
  - Settings become editable

30. Unlock with wrong PIN fails
- Steps:
  - Enter incorrect PIN
- Expected:
  - Settings remain locked
  - Error feedback appears

31. Turning saved PIN lock off deletes stored lock
- Steps:
  - Unlock settings with correct PIN
  - Turn off `Require PIN for settings changes`
  - Save
  - Reload options and popup
- Expected:
  - No unlock screen appears
  - Popup and settings are both editable without PIN

### Timeout / relock

32. Immediate relock works
- Steps:
  - Enable PIN lock
  - Select `Lock immediately after save`
  - Save
- Expected:
  - Success feedback says it relocked immediately
  - Settings lock again right after save

33. Timed relock works for 1 minute
- Steps:
  - Enable PIN lock
  - Select `Unlock for 1 minute`
  - Save
  - Unlock if needed
  - Leave options page open for more than 1 minute
- Expected:
  - Settings relock automatically after timeout

34. Changing timeout shows save action
- Steps:
  - Change `Edit session timeout`
- Expected:
  - Save control appears immediately

35. Popup respects immediate relock
- Steps:
  - Enable PIN lock
  - Select `Lock immediately after save`
  - Save
  - Open popup
- Expected:
  - Popup is locked immediately

36. Popup respects timed unlock window
- Steps:
  - Enable PIN lock
  - Select `Unlock for 1 minute`
  - Save
  - Unlock settings
  - Open popup within the unlock window
- Expected:
  - Popup is editable without asking for PIN again during the unlock window

### Popup

37. Popup opens
- Steps:
  - Click extension icon in Chrome toolbar
- Expected:
  - Popup renders without blank state

38. Popup respects lock state
- Steps:
  - Enable PIN lock and save
  - Open popup
- Expected:
  - Popup requires unlock when locked

### Placeholder image

39. Custom placeholder upload works
- Steps:
  - Upload an image
  - Save if prompted
- Expected:
  - Preview updates

40. Remove custom image resets preview
- Steps:
  - Click `Remove custom image`
- Expected:
  - Custom image is removed
  - Default preview returns

### Stats / history

41. History reset works
- Steps:
  - Click `Reset history`
- Expected:
  - Counters and recent history reset locally

### Support links

42. Feedback link opens target
- Steps:
  - Click `Feedback`
- Expected:
  - Opens configured feedback form

43. Tip link opens PayPal flow
- Steps:
  - Click `Tip`
- Expected:
  - Opens PayPal target

## Highest-risk regression set
- Browser text blocking on a live page
- Whole-block hiding on a feed/card layout
- Site rule override on a live page
- Filtering disabled state on a live page
- Parent lock enable/disable
- Save button dirty-state visibility
- Save button disabled state with invalid PIN
- Timed relock after save
- Popup locked/unlocked behavior
