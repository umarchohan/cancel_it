const STORAGE_KEY = "cancelItSettings";
const STATS_STORAGE_KEY = "cancelItStats";
const ASSETS_STORAGE_KEY = "cancelItAssets";
const LOCK_STATE_KEY = "cancelItLockState";

const PACKS = {
  celebrity_gossip: {
    label: "Celebrity Gossip",
    description: "Mute celebrity names, tabloids, and entertainment chatter.",
    terms: ["celebrity gossip", "tmz", "paparazzi", "red carpet", "tabloid", "jennifer lopez"]
  },
  politics: {
    label: "Politics",
    description: "Reduce political terms, campaign coverage, and election noise.",
    terms: ["election", "campaign", "senate", "congress", "white house", "politics"]
  },
  crypto_hype: {
    label: "Crypto Hype",
    description: "Filter pump talk, coins, and crypto speculation headlines.",
    terms: ["bitcoin", "ethereum", "solana", "memecoin", "crypto", "nft"]
  },
  sports_spoilers: {
    label: "Sports Spoilers",
    description: "Hide common spoiler phrases and sports-result chatter.",
    terms: ["final score", "match winner", "spoiler", "knockout", "highlights", "game recap"]
  },
  adult_content: {
    label: "Adult Content",
    description: "Block common adult-content and explicit-topic keywords.",
    terms: ["porn", "pornography", "nsfw", "explicit", "adult video", "onlyfans"]
  },
  family_safe: {
    label: "Family Safe",
    description: "Reduce adult, suggestive, and violent-language topics for shared browsing.",
    terms: ["porn", "nsfw", "explicit", "gore", "violent", "graphic violence", "adult content"]
  },
  ragebait: {
    label: "Ragebait",
    description: "Mute low-signal outrage bait and engagement bait patterns.",
    terms: ["you won't believe", "meltdown", "ratioed", "destroyed", "exposed", "viral outrage"]
  }
};

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "blur",
  matchScope: "inline",
  blockedTerms: ["jennifer lopez", "porn", "pornography"],
  enabledPacks: [],
  customPacks: {},
  packCustomTerms: {},
  tempMutedTerms: [],
  siteRules: [],
  parentLock: {
    enabled: false,
    pinHash: "",
    pinSalt: "",
    relockMinutes: 0
  }
};

const HELP_CONTENT = {
  "blur-inline": {
    kicker: "Blur example",
    title: "Inline blur keeps the rest of the post visible",
    copy: "Use this when you want to soften exact references while keeping surrounding context readable.",
    image: "help/blur-inline.png"
  },
  "hide-block": {
    kicker: "Hide example",
    title: "Whole block removal hides the matched post or card",
    copy: "Use this when you do not want to see the surrounding post at all once a blocked term appears.",
    image: "help/hide-block.png"
  },
  "placeholder-custom": {
    kicker: "Placeholder example",
    title: "Custom placeholder replaces the blocked area with your chosen visual",
    copy: "Use this if you want a clearer blocked state than blur or hide, especially with custom images.",
    image: "help/placeholder-custom.png"
  },
  "page-blur": {
    kicker: "Page blur example",
    title: "Page blur affects the entire webpage once a blocked term is found",
    copy: "Use this only for very strict filtering. One match can blur everything on the page.",
    image: "help/page-blur.png"
  },
  "site-rules": {
    kicker: "Site rule example",
    title: "Per-site rules decide where blocked content should appear",
    copy: "Set different behavior by site, like hide on X, blur on Google, or disable blocking on Wikipedia.",
    image: "help/site-rules.png"
  }
};

const form = document.getElementById("settings-form");
const saveDock = document.getElementById("save-dock");
const saveButton = saveDock.querySelector("button");
const enabledInput = document.getElementById("enabled");
const blockedTermsInput = document.getElementById("blocked-terms");
const statusNode = document.getElementById("status");
const totalBlockedNode = document.getElementById("total-blocked");
const blockedTodayNode = document.getElementById("blocked-today");
const blockedWeekNode = document.getElementById("blocked-week");
const trackedKeywordsNode = document.getElementById("tracked-keywords");
const topKeywordNode = document.getElementById("top-keyword");
const topSiteNode = document.getElementById("top-site");
const keywordHistoryNode = document.getElementById("keyword-history");
const recentHistoryNode = document.getElementById("recent-history");
const resetStatsButton = document.getElementById("reset-stats");
const placeholderImageInput = document.getElementById("placeholder-image");
const placeholderPreviewNode = document.getElementById("placeholder-preview");
const clearPlaceholderImageButton = document.getElementById("clear-placeholder-image");
const packListNode = document.getElementById("pack-list");
const packSelectInput = document.getElementById("pack-select");
const packCustomTermInput = document.getElementById("pack-custom-term");
const addPackTermButton = document.getElementById("add-pack-term");
const packKeywordViewNode = document.getElementById("pack-keyword-view");
const packCustomListNode = document.getElementById("pack-custom-list");
const customPackNameInput = document.getElementById("custom-pack-name");
const customPackDescriptionInput = document.getElementById("custom-pack-description");
const customPackTermsInput = document.getElementById("custom-pack-terms");
const addCustomPackButton = document.getElementById("add-custom-pack");
const customPackListNode = document.getElementById("custom-pack-list");
const tempTermInput = document.getElementById("temp-term");
const tempDurationInput = document.getElementById("temp-duration");
const addTempTermButton = document.getElementById("add-temp-term");
const tempTermListNode = document.getElementById("temp-term-list");
const sitePatternInput = document.getElementById("site-pattern");
const siteModeInput = document.getElementById("site-mode");
const siteScopeInput = document.getElementById("site-scope");
const addSiteRuleButton = document.getElementById("add-site-rule");
const siteRuleListNode = document.getElementById("site-rule-list");
const helpModal = document.getElementById("help-modal");
const helpImageNode = document.getElementById("help-image");
const helpTitleNode = document.getElementById("help-title");
const helpKickerNode = document.getElementById("help-kicker");
const helpCopyNode = document.getElementById("help-copy");
const lockEnabledInput = document.getElementById("lock-enabled");
const pinInput = document.getElementById("pin-input");
const pinConfirmInput = document.getElementById("pin-confirm-input");
const relockMinutesInput = document.getElementById("relock-minutes");
const settingsLockScreen = document.getElementById("settings-lock-screen");
const unlockPinInput = document.getElementById("unlock-pin-input");
const unlockSettingsButton = document.getElementById("unlock-settings");
const unlockStatusNode = document.getElementById("unlock-status");
const analytics = window.CancelItAnalytics || { track: () => null, summarizeSettings: () => ({}) };

let assets = { placeholderImage: "" };
let settingsState = structuredClone(DEFAULT_SETTINGS);
let lockState = { unlockedUntil: 0 };
let isUnlockedForEditing = true;
let savedSettingsSnapshot = "";
let suppressDirtyTracking = false;
let saveFeedbackTimer = 0;
let relockTimer = 0;

function setStatus(message, target = statusNode) {
  target.textContent = message;
  window.clearTimeout(target._timer);
  target._timer = window.setTimeout(() => {
    if (target === statusNode && isDirty()) {
      target.textContent = "Unsaved changes";
      return;
    }
    target.textContent = "";
  }, 2400);
}

function serializeSettings(settings) {
  return JSON.stringify(settings);
}

function collectDraftSettings() {
  return {
    enabled: enabledInput.checked,
    mode: readMode(),
    matchScope: readMatchScope(),
    blockedTerms: blockedTermsInput.value.split("\n").map(normalizeTerm).filter(Boolean),
    enabledPacks: settingsState.enabledPacks,
    customPacks: settingsState.customPacks,
    packCustomTerms: settingsState.packCustomTerms,
    tempMutedTerms: pruneExpiredTempTerms(settingsState.tempMutedTerms),
    siteRules: settingsState.siteRules,
    parentLockDraft: {
      enabled: lockEnabledInput.checked,
      relockMinutes: Number(relockMinutesInput.value || 0),
      pinHash: settingsState.parentLock?.pinHash || "",
      pinSalt: settingsState.parentLock?.pinSalt || "",
      pinInput: pinInput.value.trim(),
      pinConfirmInput: pinConfirmInput.value.trim()
    }
  };
}

function isDirty() {
  return serializeSettings(collectDraftSettings()) !== savedSettingsSnapshot;
}

function updateSaveDock() {
  const shouldHide = !isDirty() && !saveDock.classList.contains("saved-feedback");
  saveDock.classList.toggle("hidden", shouldHide);
  updateSaveButtonState();
}

function getSaveButtonIssue() {
  if (!lockEnabledInput.checked) {
    return "";
  }

  const pin = pinInput.value.trim();
  const confirmPin = pinConfirmInput.value.trim();
  const hasExistingPin = Boolean(settingsState.parentLock?.pinHash);
  const willEnableNewPin = !hasExistingPin;

  if (willEnableNewPin && !pin) {
    return "Add and confirm a PIN to save.";
  }

  if (willEnableNewPin && pin && !/^\d{4,8}$/.test(pin)) {
    return "PIN must be 4 to 8 digits.";
  }

  if (willEnableNewPin && pin && !confirmPin) {
    return "Confirm the PIN to save.";
  }

  if (willEnableNewPin && pin && pin !== confirmPin) {
    return "PIN confirmation does not match.";
  }

  return "";
}

function updateSaveButtonState() {
  const issue = getSaveButtonIssue();
  saveButton.disabled = Boolean(issue);
  saveButton.title = issue;
}

function markDirty(message = "Unsaved changes") {
  if (suppressDirtyTracking) {
    return;
  }
  window.clearTimeout(saveFeedbackTimer);
  saveDock.classList.remove("saved-feedback");
  saveButton.textContent = "Save settings";
  statusNode.textContent = message;
  updateSaveDock();
}

function markSaved(message = "Settings saved.") {
  savedSettingsSnapshot = serializeSettings(collectDraftSettings());
  window.clearTimeout(saveFeedbackTimer);
  saveDock.classList.remove("hidden");
  saveDock.classList.add("saved-feedback");
  saveButton.textContent = "Saved";
  statusNode.textContent = message;
  saveFeedbackTimer = window.setTimeout(() => {
    saveDock.classList.remove("saved-feedback");
    saveButton.textContent = "Save settings";
    statusNode.textContent = "";
    updateSaveDock();
  }, 1800);
}

function normalizeTerm(value) {
  return (value || "").trim();
}

function normalizePackId(value) {
  return normalizeTerm(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseTermsInput(value) {
  return Array.from(
    new Set(
      (value || "")
        .split(/[\n,]+/)
        .map((term) => normalizeTerm(term).toLowerCase())
        .filter(Boolean)
    )
  );
}

function getAllPacks() {
  return {
    ...PACKS,
    ...(settingsState.customPacks || {})
  };
}

function pruneExpiredTempTerms(terms) {
  const now = Date.now();
  return (terms || []).filter((entry) => !entry.expiresAt || new Date(entry.expiresAt).getTime() > now);
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "No expiry";
  }

  return new Date(timestamp).toLocaleString();
}

function setPlaceholderPreview(image) {
  if (image) {
    placeholderPreviewNode.style.setProperty("--placeholder-preview-image", `url("${image}")`);
  } else {
    placeholderPreviewNode.style.removeProperty("--placeholder-preview-image");
  }
}

function openHelp(key) {
  const help = HELP_CONTENT[key];
  if (!help) {
    return;
  }

  helpKickerNode.textContent = help.kicker;
  helpTitleNode.textContent = help.title;
  helpCopyNode.textContent = help.copy;
  helpImageNode.src = help.image;
  helpImageNode.alt = help.title;
  helpModal.showModal();
}

function readMode() {
  const checked = document.querySelector("input[name='mode']:checked");
  return checked ? checked.value : DEFAULT_SETTINGS.mode;
}

function readMatchScope() {
  const checked = document.querySelector("input[name='match-scope']:checked");
  return checked ? checked.value : DEFAULT_SETTINGS.matchScope;
}

async function sha256(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin, salt) {
  return sha256(`${salt}:${pin}`);
}

function isLockEnabled() {
  return settingsState.parentLock?.enabled && settingsState.parentLock?.pinHash;
}

function isCurrentlyUnlocked() {
  if (!isLockEnabled()) {
    return true;
  }

  return Boolean(lockState.unlockedUntil && lockState.unlockedUntil > Date.now());
}

function applyLockStateToUI() {
  isUnlockedForEditing = isCurrentlyUnlocked();
  settingsLockScreen.classList.toggle("hidden", isUnlockedForEditing || !isLockEnabled());
  form.classList.toggle("locked-content", !isUnlockedForEditing && isLockEnabled());
}

function scheduleRelockTimer() {
  window.clearTimeout(relockTimer);

  if (!isLockEnabled()) {
    return;
  }

  if (!lockState.unlockedUntil || lockState.unlockedUntil <= Date.now()) {
    return;
  }

  relockTimer = window.setTimeout(async () => {
    await clearUnlockWindow();
  }, Math.max(0, lockState.unlockedUntil - Date.now()));
}

async function persistUnlockWindow() {
  const minutes = Number(settingsState.parentLock?.relockMinutes || 0);
  const unlockedUntil = minutes === 0 ? Date.now() : Date.now() + minutes * 60 * 1000;
  lockState = { unlockedUntil };
  await chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState });
  applyLockStateToUI();
  scheduleRelockTimer();
}

async function clearUnlockWindow() {
  lockState = { unlockedUntil: 0 };
  await chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState });
  applyLockStateToUI();
  window.clearTimeout(relockTimer);
}

function renderPackSelect() {
  packSelectInput.innerHTML = "";
  for (const [packId, pack] of Object.entries(getAllPacks())) {
    const option = document.createElement("option");
    option.value = packId;
    option.textContent = pack.label;
    packSelectInput.appendChild(option);
  }
}

function renderPackList() {
  packListNode.innerHTML = "";

  for (const [packId, pack] of Object.entries(getAllPacks())) {
    const customCount = (settingsState.packCustomTerms?.[packId] || []).length;
    const isCustomPack = Boolean(settingsState.customPacks?.[packId]);
    const label = document.createElement("label");
    label.className = "pack-card";
    label.innerHTML = `
      <input type="checkbox" value="${packId}">
      ${isCustomPack ? '<span class="pack-badge">Custom pack</span>' : ""}
      <span class="pack-title">${pack.label}</span>
      <span class="pack-copy">${pack.description}</span>
      <span class="history-item-meta">${pack.terms.length} built-in • ${customCount} custom</span>
    `;

    const input = label.querySelector("input");
    input.checked = settingsState.enabledPacks.includes(packId);
    input.addEventListener("change", () => {
      if (input.checked) {
        settingsState.enabledPacks = Array.from(new Set([...settingsState.enabledPacks, packId]));
      } else {
        settingsState.enabledPacks = settingsState.enabledPacks.filter((id) => id !== packId);
      }
      analytics.track("pack_toggle_changed", {
        pack_id: packId,
        enabled: input.checked,
        enabled_pack_count: settingsState.enabledPacks.length
      });
      markDirty("Pack selection updated. Save settings to apply.");
    });

    packListNode.appendChild(label);
  }
}

function removePackCustomTerm(packId, term) {
  const nextTerms = (settingsState.packCustomTerms?.[packId] || []).filter((entry) => entry !== term);
  settingsState.packCustomTerms[packId] = nextTerms;

  if (!nextTerms.length) {
    delete settingsState.packCustomTerms[packId];
  }

  renderPackList();
  renderPackKeywordView();
  renderPackCustomList();
  markDirty("Custom pack term removed. Save settings to apply.");
}

function renderPackKeywordSection(title, terms, emptyMessage, className = "", options = {}) {
  const section = document.createElement("section");
  section.className = `pack-keyword-section ${className}`.trim();

  const heading = document.createElement("p");
  heading.className = "pack-keyword-heading";
  heading.textContent = title;
  section.appendChild(heading);

  if (!terms.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "history-item-meta";
    emptyState.textContent = emptyMessage;
    section.appendChild(emptyState);
    return section;
  }

  const chipWrap = document.createElement("div");
  chipWrap.className = "term-chip-wrap";

  for (const term of terms) {
    if (options.removable && options.packId) {
      const chipButton = document.createElement("button");
      chipButton.type = "button";
      chipButton.className = "term-chip removable-chip";
      chipButton.innerHTML = `
        <span>${term}</span>
        <span class="term-chip-remove" aria-hidden="true">×</span>
      `;
      chipButton.setAttribute("aria-label", `Remove ${term} from ${getAllPacks()[options.packId]?.label || options.packId}`);
      chipButton.addEventListener("click", () => removePackCustomTerm(options.packId, term));
      chipWrap.appendChild(chipButton);
      continue;
    }

    const chip = document.createElement("span");
    chip.className = "term-chip";
    chip.textContent = term;
    chipWrap.appendChild(chip);
  }

  section.appendChild(chipWrap);
  return section;
}

function renderPackKeywordView() {
  const packId = packSelectInput.value;
  const pack = getAllPacks()[packId];

  if (!pack) {
    packKeywordViewNode.innerHTML = "";
    return;
  }

  const customTerms = settingsState.packCustomTerms?.[packId] || [];
  packKeywordViewNode.innerHTML = `
    <div class="pack-keyword-top">
      <div>
        <p class="pack-keyword-kicker">Selected pack keywords</p>
        <h3>${pack.label}</h3>
      </div>
      <p class="history-item-meta">${pack.terms.length} built-in • ${customTerms.length} custom</p>
    </div>
    <p class="pack-keyword-copy">${pack.description}</p>
  `;

  packKeywordViewNode.appendChild(
    renderPackKeywordSection("Built-in keywords", pack.terms, "No built-in keywords.")
  );
  packKeywordViewNode.appendChild(
    renderPackKeywordSection(
      "Your custom keywords",
      customTerms,
      "No custom keywords added yet.",
      "custom-keywords",
      { removable: true, packId }
    )
  );
}

function renderPackCustomList() {
  packCustomListNode.innerHTML = "";
  const entries = Object.entries(settingsState.packCustomTerms || {}).filter(([, terms]) => terms.length);

  if (!entries.length) {
    packCustomListNode.innerHTML = '<div class="list-item"><p class="history-item-meta">No custom pack terms yet.</p></div>';
    return;
  }

  for (const [packId, terms] of entries) {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-top">
        <span class="history-item-term">${getAllPacks()[packId]?.label || packId}</span>
        <button type="button" class="ghost-button compact-button">Clear</button>
      </div>
      <p class="history-item-meta">${terms.join(", ")}</p>
    `;

    item.querySelector("button").addEventListener("click", () => {
      delete settingsState.packCustomTerms[packId];
      renderPackList();
      renderPackKeywordView();
      renderPackCustomList();
      markDirty("Custom pack terms cleared. Save settings to apply.");
    });

    packCustomListNode.appendChild(item);
  }
}

function renderCustomPackList() {
  customPackListNode.innerHTML = "";
  const entries = Object.entries(settingsState.customPacks || {});

  if (!entries.length) {
    customPackListNode.innerHTML = '<div class="list-item"><p class="history-item-meta">No custom packs yet.</p></div>';
    return;
  }

  for (const [packId, pack] of entries) {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-top">
        <span class="history-item-term">${pack.label}</span>
        <button type="button" class="ghost-button compact-button">Remove</button>
      </div>
      <p class="history-item-meta">${pack.description || "No description"} • ${pack.terms.length} keyword${pack.terms.length === 1 ? "" : "s"}</p>
    `;

    item.querySelector("button").addEventListener("click", () => {
      delete settingsState.customPacks[packId];
      delete settingsState.packCustomTerms[packId];
      settingsState.enabledPacks = settingsState.enabledPacks.filter((id) => id !== packId);
      renderPackSelect();
      renderPackList();
      renderPackKeywordView();
      renderPackCustomList();
      renderCustomPackList();
      markDirty("Custom pack removed. Save settings to apply.");
    });

    customPackListNode.appendChild(item);
  }
}

function renderTempTermList() {
  tempTermListNode.innerHTML = "";
  settingsState.tempMutedTerms = pruneExpiredTempTerms(settingsState.tempMutedTerms);

  if (!settingsState.tempMutedTerms.length) {
    tempTermListNode.innerHTML = '<div class="list-item"><p class="history-item-meta">No temporary mutes yet.</p></div>';
    return;
  }

  for (const entry of settingsState.tempMutedTerms) {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-top">
        <span class="history-item-term">${entry.term}</span>
        <button type="button" class="ghost-button compact-button">Remove</button>
      </div>
      <p class="history-item-meta">${entry.label} • ${formatTime(entry.expiresAt)}</p>
    `;

    item.querySelector("button").addEventListener("click", () => {
      settingsState.tempMutedTerms = settingsState.tempMutedTerms.filter((term) => term.id !== entry.id);
      renderTempTermList();
      markDirty("Temporary mute removed. Save settings to apply.");
    });

    tempTermListNode.appendChild(item);
  }
}

function renderSiteRuleList() {
  siteRuleListNode.innerHTML = "";

  if (!settingsState.siteRules.length) {
    siteRuleListNode.innerHTML = '<div class="list-item"><p class="history-item-meta">No site rules yet.</p></div>';
    return;
  }

  for (const rule of settingsState.siteRules) {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-top">
        <span class="history-item-term">${rule.pattern}</span>
        <button type="button" class="ghost-button compact-button">Remove</button>
      </div>
      <p class="history-item-meta">${rule.mode} • ${rule.matchScope} scope • ${rule.enabled ? "enabled" : "disabled"}</p>
    `;

    item.querySelector("button").addEventListener("click", () => {
      settingsState.siteRules = settingsState.siteRules.filter((entry) => entry.id !== rule.id);
      renderSiteRuleList();
      markDirty("Site rule removed. Save settings to apply.");
    });

    siteRuleListNode.appendChild(item);
  }
}

function applySettings(rawSettings) {
  suppressDirtyTracking = true;
  settingsState = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...(rawSettings || {}),
    parentLock: {
      ...structuredClone(DEFAULT_SETTINGS.parentLock),
      ...(rawSettings?.parentLock || {})
    }
  };

  settingsState.tempMutedTerms = pruneExpiredTempTerms(settingsState.tempMutedTerms);
  settingsState.packCustomTerms = settingsState.packCustomTerms || {};
  settingsState.customPacks = settingsState.customPacks || {};

  enabledInput.checked = settingsState.enabled;
  blockedTermsInput.value = (settingsState.blockedTerms || []).join("\n");
  lockEnabledInput.checked = Boolean(settingsState.parentLock?.enabled);
  relockMinutesInput.value = String(settingsState.parentLock?.relockMinutes ?? 0);
  pinInput.value = "";
  pinConfirmInput.value = "";

  const modeInput = document.querySelector(`input[name="mode"][value="${settingsState.mode}"]`);
  if (modeInput) {
    modeInput.checked = true;
  }

  const scopeInput = document.querySelector(`input[name="match-scope"][value="${settingsState.matchScope}"]`);
  if (scopeInput) {
    scopeInput.checked = true;
  }

  renderPackSelect();
  renderPackList();
  renderPackKeywordView();
  renderPackCustomList();
  renderCustomPackList();
  renderTempTermList();
  renderSiteRuleList();
  applyLockStateToUI();
  scheduleRelockTimer();
  savedSettingsSnapshot = serializeSettings(collectDraftSettings());
  updateSaveDock();
  statusNode.textContent = "Unsaved changes";
  suppressDirtyTracking = false;
}

function collectSettings() {
  return {
    enabled: enabledInput.checked,
    mode: readMode(),
    matchScope: readMatchScope(),
    blockedTerms: blockedTermsInput.value.split("\n").map(normalizeTerm).filter(Boolean),
    enabledPacks: settingsState.enabledPacks,
    customPacks: settingsState.customPacks,
    packCustomTerms: settingsState.packCustomTerms,
    tempMutedTerms: pruneExpiredTempTerms(settingsState.tempMutedTerms),
    siteRules: settingsState.siteRules,
    parentLock: settingsState.parentLock
  };
}

function trackSettingsEvent(eventName, extra = {}) {
  analytics.track(eventName, {
    ...analytics.summarizeSettings(collectSettings()),
    ...extra
  });
}

function renderEmptyState(node, message) {
  node.innerHTML = "";
  const item = document.createElement("div");
  item.className = "history-item";
  item.innerHTML = `<p class="history-item-meta">${message}</p>`;
  node.appendChild(item);
}

function renderKeywordHistory(byKeyword) {
  keywordHistoryNode.innerHTML = "";
  const entries = Object.entries(byKeyword || {}).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    renderEmptyState(keywordHistoryNode, "No blocked keyword history yet.");
    return;
  }

  for (const [term, count] of entries.slice(0, 12)) {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-item-top">
        <span class="history-item-term">${term}</span>
        <span class="history-item-count">${count}</span>
      </div>
      <p class="history-item-meta">Times blocked</p>
    `;
    keywordHistoryNode.appendChild(item);
  }
}

function renderRecentHistory(recent) {
  recentHistoryNode.innerHTML = "";
  if (!recent.length) {
    renderEmptyState(recentHistoryNode, "No recent blocked items yet.");
    return;
  }

  for (const entry of recent.slice(0, 12)) {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-item-top">
        <span class="history-item-term">${entry.term}</span>
        <span class="history-item-meta">${entry.type}</span>
      </div>
      <p class="history-item-meta">${entry.host} • ${formatTime(entry.timestamp)}</p>
    `;
    recentHistoryNode.appendChild(item);
  }
}

function renderStats(stats) {
  const safeStats = stats || { totalBlocked: 0, byKeyword: {}, recent: [] };
  const recent = safeStats.recent || [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const blockedToday = recent.filter((entry) => new Date(entry.timestamp).getTime() >= dayAgo).length;
  const blockedWeek = recent.filter((entry) => new Date(entry.timestamp).getTime() >= weekAgo).length;
  const topKeyword = Object.entries(safeStats.byKeyword || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const topSiteCounts = recent.reduce((accumulator, entry) => {
    accumulator[entry.host] = (accumulator[entry.host] || 0) + 1;
    return accumulator;
  }, {});
  const topSite = Object.entries(topSiteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  totalBlockedNode.textContent = String(safeStats.totalBlocked || 0);
  blockedTodayNode.textContent = String(blockedToday);
  blockedWeekNode.textContent = String(blockedWeek);
  trackedKeywordsNode.textContent = String(Object.keys(safeStats.byKeyword || {}).length);
  topKeywordNode.textContent = topKeyword;
  topSiteNode.textContent = topSite;
  renderKeywordHistory(safeStats.byKeyword || {});
  renderRecentHistory(recent);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function saveAssets(message) {
  chrome.storage.local.set({ [ASSETS_STORAGE_KEY]: assets }, () => {
    setPlaceholderPreview(assets.placeholderImage);
    if (message) {
      setStatus(message);
    }
  });
}

function makeTempEntry(term, durationKey) {
  const now = Date.now();
  const durations = {
    "24h": { label: "24 hours", expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString() },
    "7d": { label: "7 days", expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString() },
    manual: { label: "Until manually removed", expiresAt: null }
  };

  const selected = durations[durationKey] || durations["24h"];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    term,
    label: selected.label,
    expiresAt: selected.expiresAt
  };
}

function getRelockSummary() {
  if (!settingsState.parentLock?.enabled || !settingsState.parentLock?.pinHash) {
    return "Settings saved.";
  }

  const minutes = Number(settingsState.parentLock?.relockMinutes || 0);
  if (minutes === 0) {
    return "Settings saved. Extension locked again immediately.";
  }

  return `Settings saved. Extension will relock in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

async function validateAndPrepareLock() {
  const enabled = lockEnabledInput.checked;
  const relockMinutes = Number(relockMinutesInput.value || 0);

  if (!enabled) {
    settingsState.parentLock = { enabled: false, pinHash: "", pinSalt: "", relockMinutes };
    await clearUnlockWindow();
    return { ok: true };
  }

  const pin = pinInput.value.trim();
  const confirmPin = pinConfirmInput.value.trim();
  const existingHash = settingsState.parentLock?.pinHash;

  if (!existingHash && !pin) {
    return { ok: false, message: "Enter a parent PIN to enable lock." };
  }

  if (pin && !/^\d{4,8}$/.test(pin)) {
    return { ok: false, message: "PIN must be 4 to 8 digits." };
  }

  if (pin && pin !== confirmPin) {
    return { ok: false, message: "PIN confirmation does not match." };
  }

  if (pin) {
    const salt = createSalt();
    const pinHash = await hashPin(pin, salt);
    settingsState.parentLock = { enabled: true, pinHash, pinSalt: salt, relockMinutes };
  } else {
    settingsState.parentLock = {
      ...settingsState.parentLock,
      enabled: true,
      relockMinutes
    };
  }

  return { ok: true };
}

async function unlockWithPin(pin, targetStatusNode) {
  const candidate = pin.trim();
  const { pinSalt, pinHash } = settingsState.parentLock || {};
  const computed = await hashPin(candidate, pinSalt);

  if (computed !== pinHash) {
    setStatus("Incorrect PIN.", targetStatusNode);
    return false;
  }

  await persistUnlockWindow();
  setStatus("Unlocked.", targetStatusNode);
  unlockPinInput.value = "";
  return true;
}

async function loadSettings() {
  const syncResult = await chrome.storage.sync.get([STORAGE_KEY]);
  const localResult = await chrome.storage.local.get([STATS_STORAGE_KEY, ASSETS_STORAGE_KEY, LOCK_STATE_KEY]);

  applySettings({ ...structuredClone(DEFAULT_SETTINGS), ...(syncResult[STORAGE_KEY] || {}) });
  renderStats(localResult[STATS_STORAGE_KEY]);
  assets = { ...assets, ...(localResult[ASSETS_STORAGE_KEY] || {}) };
  lockState = { unlockedUntil: localResult[LOCK_STATE_KEY]?.unlockedUntil || 0 };
  setPlaceholderPreview(assets.placeholderImage);
  applyLockStateToUI();
}

document.querySelectorAll(".help-trigger, .head-help-trigger").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openHelp(button.dataset.helpKey);
  });
});

helpModal.addEventListener("click", (event) => {
  const rect = helpModal.getBoundingClientRect();
  const inside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;

  if (!inside) {
    helpModal.close();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isLockEnabled() && !isUnlockedForEditing) {
    setStatus("Unlock settings first.");
    return;
  }

  const lockCheck = await validateAndPrepareLock();
  if (!lockCheck.ok) {
    setStatus(lockCheck.message);
    return;
  }

  chrome.storage.sync.set({ [STORAGE_KEY]: collectSettings() }, async () => {
    if (settingsState.parentLock.enabled) {
      await persistUnlockWindow();
      if (settingsState.parentLock.relockMinutes === 0) {
        await clearUnlockWindow();
      }
    }
    pinInput.value = "";
    pinConfirmInput.value = "";
    trackSettingsEvent("settings_saved", {
      save_surface: "options",
      relock_behavior: settingsState.parentLock?.enabled
        ? (Number(settingsState.parentLock?.relockMinutes || 0) === 0 ? "immediate" : "timed")
        : "disabled"
    });
    markSaved(getRelockSummary());
  });
});

addPackTermButton.addEventListener("click", () => {
  const packId = packSelectInput.value;
  const term = normalizeTerm(packCustomTermInput.value).toLowerCase();
  if (!packId || !term) {
    setStatus("Choose a pack and enter a term.");
    return;
  }

  settingsState.packCustomTerms[packId] = Array.from(new Set([...(settingsState.packCustomTerms[packId] || []), term]));
  packCustomTermInput.value = "";
  renderPackList();
  renderPackKeywordView();
  renderPackCustomList();
  analytics.track("pack_custom_term_added", {
    pack_id: packId,
    custom_term_count_for_pack: settingsState.packCustomTerms[packId].length,
    total_custom_pack_term_count: Object.values(settingsState.packCustomTerms).reduce((sum, terms) => sum + terms.length, 0)
  });
  markDirty("Custom pack term added. Save settings to apply.");
});

addCustomPackButton.addEventListener("click", () => {
  const label = normalizeTerm(customPackNameInput.value);
  const description = normalizeTerm(customPackDescriptionInput.value);
  const terms = parseTermsInput(customPackTermsInput.value);
  const packIdBase = normalizePackId(label);

  if (!label) {
    setStatus("Enter a custom pack name.");
    return;
  }

  if (!terms.length) {
    setStatus("Add at least one keyword for the custom pack.");
    return;
  }

  if (!packIdBase) {
    setStatus("Custom pack name needs letters or numbers.");
    return;
  }

  let packId = `custom_${packIdBase}`;
  let suffix = 2;
  while (getAllPacks()[packId]) {
    packId = `custom_${packIdBase}_${suffix}`;
    suffix += 1;
  }

  settingsState.customPacks[packId] = {
    label,
    description: description || "User-created pack for personal filtering.",
    terms
  };

  settingsState.enabledPacks = Array.from(new Set([...settingsState.enabledPacks, packId]));
  customPackNameInput.value = "";
  customPackDescriptionInput.value = "";
  customPackTermsInput.value = "";
  renderPackSelect();
  packSelectInput.value = packId;
  renderPackList();
  renderPackKeywordView();
  renderPackCustomList();
  renderCustomPackList();
  analytics.track("custom_pack_created", {
    pack_id: packId,
    initial_term_count: terms.length,
    enabled_pack_count: settingsState.enabledPacks.length,
    custom_pack_count: Object.keys(settingsState.customPacks).length
  });
  markDirty("Custom pack created. Save settings to apply.");
});

packSelectInput.addEventListener("change", () => {
  renderPackKeywordView();
});

addTempTermButton.addEventListener("click", () => {
  const term = normalizeTerm(tempTermInput.value);
  if (!term) {
    setStatus("Enter a term for temporary mute.");
    return;
  }

  settingsState.tempMutedTerms.unshift(makeTempEntry(term, tempDurationInput.value));
  tempTermInput.value = "";
  renderTempTermList();
  analytics.track("temp_mute_added", {
    duration_selected: tempDurationInput.value,
    temp_mute_count: settingsState.tempMutedTerms.length
  });
  markDirty("Temporary mute added. Save settings to apply.");
});

addSiteRuleButton.addEventListener("click", () => {
  const pattern = normalizeTerm(sitePatternInput.value).toLowerCase();
  if (!pattern) {
    setStatus("Enter a site pattern like x.com or youtube.com.");
    return;
  }

  settingsState.siteRules.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pattern,
    mode: siteModeInput.value,
    matchScope: siteScopeInput.value,
    enabled: true
  });

  sitePatternInput.value = "";
  renderSiteRuleList();
  analytics.track("site_rule_added", {
    mode_selected: siteModeInput.value,
    scope_selected: siteScopeInput.value,
    site_rule_count: settingsState.siteRules.length
  });
  markDirty("Site rule added. Save settings to apply.");
});

resetStatsButton.addEventListener("click", () => {
  chrome.storage.local.set({
    [STATS_STORAGE_KEY]: {
      totalBlocked: 0,
      byKeyword: {},
      recent: [],
      lastUpdated: new Date().toISOString()
    }
  }, () => {
    renderStats({ totalBlocked: 0, byKeyword: {}, recent: [] });
    setStatus("History reset.");
  });
});

placeholderImageInput.addEventListener("change", async (event) => {
  const [file] = Array.from(event.target.files || []);
  if (!file) {
    return;
  }

  try {
    assets.placeholderImage = await readFileAsDataUrl(file);
    placeholderImageInput.value = "";
    saveAssets("Custom placeholder image saved.");
  } catch (_error) {
    setStatus("Placeholder image failed to load.");
  }
});

clearPlaceholderImageButton.addEventListener("click", () => {
  assets.placeholderImage = "";
  saveAssets("Custom placeholder image removed.");
});

lockEnabledInput.addEventListener("change", () => {
  if (!lockEnabledInput.checked) {
    pinInput.value = "";
    pinConfirmInput.value = "";
    settingsState.parentLock = {
      ...settingsState.parentLock,
      enabled: false,
      pinHash: "",
      pinSalt: ""
    };
    markDirty("PIN protection will be removed after save.");
    return;
  }

  markDirty("Add and confirm a PIN to save.");
});

form.addEventListener("input", () => {
  markDirty();
});

form.addEventListener("change", () => {
  markDirty();
});

unlockSettingsButton.addEventListener("click", async () => {
  if (!unlockPinInput.value.trim()) {
    setStatus("Enter PIN.", unlockStatusNode);
    return;
  }

  await unlockWithPin(unlockPinInput.value, unlockStatusNode);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STATS_STORAGE_KEY]) {
    renderStats(changes[STATS_STORAGE_KEY].newValue);
  }

  if (areaName === "local" && changes[ASSETS_STORAGE_KEY]) {
    assets = { ...assets, ...(changes[ASSETS_STORAGE_KEY].newValue || {}) };
    setPlaceholderPreview(assets.placeholderImage);
  }

  if (areaName === "local" && changes[LOCK_STATE_KEY]) {
    lockState = { unlockedUntil: changes[LOCK_STATE_KEY].newValue?.unlockedUntil || 0 };
    applyLockStateToUI();
  }
});

loadSettings();
