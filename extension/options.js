const STORAGE_KEY = "cancelItSettings";
const STATS_STORAGE_KEY = "cancelItStats";
const ASSETS_STORAGE_KEY = "cancelItAssets";
const LOCK_STATE_KEY = "cancelItLockState";
const IMMEDIATE_RELOCK_WINDOW_MS = 10 * 60 * 1000;

const PACKS = {
  celebrity_gossip: {
    label: "Celebrity Gossip",
    description: "Tabloid names, red-carpet drama, breakup rumors.",
    terms: ["celebrity gossip", "tmz", "paparazzi", "red carpet", "tabloid", "jennifer lopez"]
  },
  politics: {
    label: "Politics",
    description: "Elections, campaigns, and political outrage cycles.",
    terms: ["election", "campaign", "senate", "congress", "white house", "politics"]
  },
  crypto_hype: {
    label: "Crypto Hype",
    description: "Coins, tokens, and get-rich-quick chatter.",
    terms: ["bitcoin", "ethereum", "solana", "memecoin", "crypto", "nft"]
  },
  sports_spoilers: {
    label: "Sports Spoilers",
    description: "Scores and results before you can watch the game.",
    terms: ["final score", "match winner", "spoiler", "knockout", "highlights", "game recap"]
  },
  adult_content: {
    label: "Adult Content",
    description: "Explicit and adult-only material.",
    terms: ["porn", "pornography", "nsfw", "explicit", "adult video", "onlyfans"]
  },
  family_safe: {
    label: "Family Safe",
    description: "A broader everyday filter for shared computers.",
    terms: ["porn", "nsfw", "explicit", "gore", "violent", "graphic violence", "adult content"]
  },
  ragebait: {
    label: "Ragebait",
    description: "Headlines engineered to make you angry.",
    terms: ["you won't believe", "meltdown", "ratioed", "destroyed", "exposed", "viral outrage"]
  },
  ai_hype: {
    label: "AI Hype",
    description: "Chatbot buzz, generative-AI takes, and prompt-engineering hot air.",
    terms: ["chatgpt", "ai-generated", "artificial intelligence", "generative ai", "ai hype", "prompt engineering"]
  },
  reality_tv: {
    label: "Reality TV",
    description: "Dating shows, competition drama, and reality TV recap spoilers.",
    terms: ["reality tv", "reality show", "love island", "bachelor nation", "rose ceremony", "elimination episode"]
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
  shareUsageStats: false,
  parentLock: {
    enabled: false,
    pinHash: "",
    pinSalt: "",
    relockMinutes: 0
  }
};

const MODE_LABELS = {
  blur: "Blur it",
  hide: "Hide it",
  placeholder: "Placeholder",
  "page-blur": "Blur whole page"
};

const RELOCK_OPTIONS = [
  { minutes: 0, label: "Right after saving", note: "Settings lock again the moment you save." },
  { minutes: 1, label: "After 1 minute", note: "You get 1 minute of editing before the lock returns." },
  { minutes: 5, label: "After 5 minutes", note: "You get 5 minutes of editing before the lock returns." },
  { minutes: 15, label: "After 15 minutes", note: "You get 15 minutes of editing before the lock returns." },
  { minutes: 60, label: "After 1 hour", note: "You get a full hour of editing before the lock returns." }
];

const HELP_CONTENT = {
  "blur-inline": {
    title: "Blur it — example",
    copy: "Matching words and images get a soft blur exactly where they appear. Spoiler-safe, and the page layout never shifts.",
    image: "help/blur-inline.webp"
  },
  "hide-block": {
    title: "Hide it — example",
    copy: "Matching content is removed from the page entirely. The cleanest option, but you won't know anything was filtered.",
    image: "help/hide-block.webp"
  },
  "placeholder-custom": {
    title: "Placeholder — example",
    copy: "Matches are swapped for a neutral card so you stay aware without seeing the content. You can replace the card with your own image below.",
    image: "help/placeholder-custom.webp"
  },
  "page-blur": {
    title: "Blur the whole page — example",
    copy: "The strictest style: if any blocked term appears anywhere on a page, the entire page is blurred. Best for family computers.",
    image: "help/page-blur.webp"
  },
  "site-rules": {
    title: "Site rules — example",
    copy: "A site rule overrides your general style and scope on one domain — for example hide whole posts on facebook.com, blur only references on google.com, and turn filtering off on wikipedia.org. The most specific matching rule wins.",
    image: "help/site-rules.webp"
  }
};

const SECTIONS = ["overview", "blocklist", "packs", "sites", "appearance", "family", "activity", "support"];

const analytics = window.CancelItAnalytics || { track: () => null, summarizeSettings: () => ({}) };

const dom = {
  headerStatusCard: document.getElementById("header-status-card"),
  headerStatusText: document.getElementById("header-status-text"),
  headerToggle: document.getElementById("header-toggle"),
  lockScreen: document.getElementById("lock-screen"),
  unlockPin: document.getElementById("unlock-pin"),
  unlockError: document.getElementById("unlock-error"),
  unlockButton: document.getElementById("unlock-button"),
  layout: document.getElementById("settings-layout"),
  navItems: Array.from(document.querySelectorAll(".nav-item[data-section]")),
  heroTitle: document.getElementById("hero-title"),
  heroSub: document.getElementById("hero-sub"),
  tileTerms: document.getElementById("tile-terms"),
  tilePacks: document.getElementById("tile-packs"),
  tileMode: document.getElementById("tile-mode"),
  addTermInput: document.getElementById("add-term"),
  addTermButton: document.getElementById("add-term-button"),
  termChips: document.getElementById("term-chips"),
  tempTermInput: document.getElementById("temp-term"),
  tempDuration: document.getElementById("temp-duration"),
  addTempButton: document.getElementById("add-temp-button"),
  tempList: document.getElementById("temp-list"),
  tempEmpty: document.getElementById("temp-empty"),
  newPackToggle: document.getElementById("new-pack-toggle"),
  newPackForm: document.getElementById("new-pack-form"),
  npName: document.getElementById("np-name"),
  npDesc: document.getElementById("np-desc"),
  npTerms: document.getElementById("np-terms"),
  npError: document.getElementById("np-error"),
  createPackButton: document.getElementById("create-pack-button"),
  cancelPackButton: document.getElementById("cancel-pack-button"),
  packList: document.getElementById("pack-list"),
  siteRuleList: document.getElementById("site-rule-list"),
  siteRulesEmpty: document.getElementById("site-rules-empty"),
  siteDomain: document.getElementById("site-domain"),
  addRuleButton: document.getElementById("add-rule-button"),
  modeCards: Array.from(document.querySelectorAll("#mode-cards .option-card")),
  scopeCards: Array.from(document.querySelectorAll("#scope-cards .option-card")),
  placeholderCard: document.getElementById("placeholder-card"),
  placeholderNote: document.getElementById("placeholder-note"),
  placeholderPreviewRow: document.getElementById("placeholder-preview-row"),
  placeholderPreview: document.getElementById("placeholder-preview"),
  removeImageButton: document.getElementById("remove-image-button"),
  uploadZone: document.getElementById("upload-zone"),
  placeholderImageInput: document.getElementById("placeholder-image"),
  pinToggle: document.getElementById("pin-toggle"),
  pinConfig: document.getElementById("pin-config"),
  pinInput: document.getElementById("pin-input"),
  pinConfirm: document.getElementById("pin-confirm"),
  pinKeepNote: document.getElementById("pin-keep-note"),
  pinError: document.getElementById("pin-error"),
  relockOptions: document.getElementById("relock-options"),
  relockNote: document.getElementById("relock-note"),
  lockNowRow: document.getElementById("lock-now-row"),
  lockNowButton: document.getElementById("lock-now-button"),
  analyticsToggle: document.getElementById("analytics-toggle"),
  resetStatsButton: document.getElementById("reset-stats-button"),
  statToday: document.getElementById("stat-today"),
  statWeek: document.getElementById("stat-week"),
  statTotal: document.getElementById("stat-total"),
  statKeywords: document.getElementById("stat-keywords"),
  statTopKeyword: document.getElementById("stat-top-keyword"),
  statTopSite: document.getElementById("stat-top-site"),
  recentList: document.getElementById("recent-list"),
  recentEmpty: document.getElementById("recent-empty"),
  versionLabel: document.getElementById("version-label"),
  rateLink: document.getElementById("rate-link"),
  rateLinkSupport: document.getElementById("rate-link-support"),
  saveBar: document.getElementById("save-bar"),
  saveButton: document.getElementById("save-button"),
  discardButton: document.getElementById("discard-button"),
  savedToast: document.getElementById("saved-toast"),
  savedToastText: document.getElementById("saved-toast-text"),
  helpModal: document.getElementById("help-modal"),
  helpTitle: document.getElementById("help-title"),
  helpCopy: document.getElementById("help-copy"),
  helpImage: document.getElementById("help-image"),
  helpClose: document.getElementById("help-close")
};

let settingsState = structuredClone(DEFAULT_SETTINGS);
let hasUnsavedChanges = false;
let assets = { placeholderImage: "" };
let lockState = { unlockedUntil: 0 };
let statsCache = null;
let activeSection = "overview";
let openPacks = new Set();
let packDrafts = {};
let relockTimer = 0;
let toastTimer = 0;

/* ---------- helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
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
  return { ...PACKS, ...(settingsState.customPacks || {}) };
}

function pruneExpiredTempTerms(terms) {
  const now = Date.now();
  return (terms || []).filter((entry) => !entry.expiresAt || new Date(entry.expiresAt).getTime() > now);
}

function timeAgo(timestamp) {
  if (!timestamp) {
    return "";
  }

  const delta = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(delta) || delta < 0) {
    return "";
  }

  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return new Date(timestamp).toLocaleDateString();
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

/* ---------- dirty tracking ---------- */

// Dirty state is an explicit flag: set by every mutating control, cleared on
// save/discard/reload. Never inferred by comparing serialized settings — that
// broke when values drifted through the chrome.storage round-trip.
function isDirty() {
  return hasUnsavedChanges;
}

function markDirty() {
  hasUnsavedChanges = true;
  renderSaveBar();
}

function clearDirty() {
  hasUnsavedChanges = false;
}

function getSaveIssue() {
  if (!settingsState.parentLock?.enabled) {
    return "";
  }

  const pin = dom.pinInput.value.trim();
  const confirmPin = dom.pinConfirm.value.trim();
  const hasExistingPin = Boolean(settingsState.parentLock?.pinHash);

  if (!hasExistingPin && !pin) {
    return "Choose a PIN to turn on family controls.";
  }

  if (pin && !/^\d{4,8}$/.test(pin)) {
    return "The PIN must be 4 to 8 digits.";
  }

  if (pin && pin !== confirmPin) {
    return "The two PINs don't match. Try typing them again.";
  }

  return "";
}

function renderSaveBar() {
  const dirty = isDirty();
  dom.saveBar.classList.toggle("hidden", !dirty || isLockedNow());
  if (dirty) {
    dom.savedToast.classList.add("hidden");
  }

  const issue = getSaveIssue();
  dom.saveButton.disabled = Boolean(issue);
  dom.saveButton.title = issue;

  const pinFieldsTouched = dom.pinInput.value || dom.pinConfirm.value;
  const showPinIssue = issue && (pinFieldsTouched || !settingsState.parentLock?.pinHash);
  dom.pinError.textContent = showPinIssue ? issue : "";
  dom.pinError.classList.toggle("hidden", !showPinIssue);
  dom.pinInput.classList.toggle("invalid", Boolean(showPinIssue && pinFieldsTouched));
  dom.pinConfirm.classList.toggle("invalid", Boolean(showPinIssue && pinFieldsTouched));
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  dom.savedToastText.textContent = message;
  dom.savedToast.classList.toggle("error", isError);
  dom.savedToast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => {
    dom.savedToast.classList.add("hidden");
  }, isError ? 4200 : 2200);
}

/* ---------- lock ---------- */

function isLockEnabled() {
  return Boolean(settingsState.parentLock?.enabled && settingsState.parentLock?.pinHash);
}

function isLockedNow() {
  if (!isLockEnabled()) {
    return false;
  }

  return !(lockState.unlockedUntil && lockState.unlockedUntil > Date.now());
}

function renderLockScreen() {
  const locked = isLockedNow();
  dom.lockScreen.classList.toggle("hidden", !locked);
  dom.layout.classList.toggle("hidden", locked);
  dom.headerStatusCard.classList.toggle("hidden", locked);
  if (locked) {
    dom.saveBar.classList.add("hidden");
  } else {
    dom.unlockPin.value = "";
    dom.unlockError.classList.add("hidden");
  }
}

function scheduleRelockTimer() {
  window.clearTimeout(relockTimer);
  if (!isLockEnabled() || !lockState.unlockedUntil || lockState.unlockedUntil <= Date.now()) {
    return;
  }

  relockTimer = window.setTimeout(() => {
    lockState = { unlockedUntil: 0 };
    chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState });
    renderLockScreen();
  }, Math.max(0, lockState.unlockedUntil - Date.now()));
}

async function persistUnlockWindow() {
  const minutes = Number(settingsState.parentLock?.relockMinutes || 0);
  const windowMs = minutes === 0 ? IMMEDIATE_RELOCK_WINDOW_MS : minutes * 60 * 1000;
  lockState = { unlockedUntil: Date.now() + windowMs };
  await chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState });
  renderLockScreen();
  scheduleRelockTimer();
}

async function clearUnlockWindow() {
  lockState = { unlockedUntil: 0 };
  await chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState });
  window.clearTimeout(relockTimer);
  renderLockScreen();
}

async function unlockWithPin(pin) {
  const { pinSalt, pinHash } = settingsState.parentLock || {};
  const computed = await hashPin(pin, pinSalt);
  if (computed !== pinHash) {
    dom.unlockError.textContent = "That PIN doesn't match. Try again.";
    dom.unlockError.classList.remove("hidden");
    dom.unlockPin.value = "";
    return;
  }

  await persistUnlockWindow();
}

/* ---------- navigation ---------- */

function setSection(sectionId) {
  if (!SECTIONS.includes(sectionId)) {
    sectionId = "overview";
  }

  activeSection = sectionId;
  for (const item of dom.navItems) {
    item.classList.toggle("active", item.dataset.section === sectionId);
  }

  for (const id of SECTIONS) {
    document.getElementById(`section-${id}`)?.classList.toggle("hidden", id !== sectionId);
  }

  if (location.hash !== `#${sectionId}`) {
    history.replaceState(null, "", `#${sectionId}`);
  }
}

/* ---------- rendering ---------- */

function renderGlobalStatus() {
  const enabled = Boolean(settingsState.enabled);
  dom.headerToggle.setAttribute("aria-checked", String(enabled));
  dom.headerStatusText.textContent = enabled ? "Filtering on" : "Paused";
  dom.headerStatusText.classList.toggle("on", enabled);
  dom.headerStatusText.classList.toggle("paused", !enabled);

  dom.heroTitle.textContent = enabled
    ? "Cancel It is watching for your muted topics"
    : "Filtering is paused everywhere";
  dom.heroSub.textContent = enabled
    ? "Pages you visit are checked on your device against your blocklist and enabled packs."
    : "Nothing is being filtered right now. Turn it back on when you're ready.";
}

function renderOverviewTiles() {
  const termCount = (settingsState.blockedTerms || []).length;
  const packsOn = (settingsState.enabledPacks || []).length;
  const packsTotal = Object.keys(getAllPacks()).length;
  dom.tileTerms.textContent = `${termCount} term${termCount === 1 ? "" : "s"}`;
  dom.tilePacks.textContent = `${packsOn} of ${packsTotal}`;
  dom.tileMode.textContent = MODE_LABELS[settingsState.mode] || MODE_LABELS.blur;
}

function renderBlocklist() {
  dom.termChips.textContent = "";
  for (const term of settingsState.blockedTerms || []) {
    const chip = el("span", "chip", term);
    const remove = el("button", "chip-remove", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${term}`);
    remove.addEventListener("click", () => {
      settingsState.blockedTerms = settingsState.blockedTerms.filter((entry) => entry !== term);
      renderBlocklist();
      renderOverviewTiles();
      markDirty();
    });
    chip.appendChild(remove);
    dom.termChips.appendChild(chip);
  }
}

function describeTempDuration(entry) {
  if (!entry.expiresAt) {
    return "Until removed";
  }

  const remaining = new Date(entry.expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    return "Expired";
  }

  const hours = Math.ceil(remaining / 3600000);
  if (hours <= 48) {
    return `${hours} hr${hours === 1 ? "" : "s"} left`;
  }

  return `${Math.ceil(hours / 24)} days left`;
}

function renderTempList() {
  settingsState.tempMutedTerms = pruneExpiredTempTerms(settingsState.tempMutedTerms);
  dom.tempList.textContent = "";
  const entries = settingsState.tempMutedTerms || [];
  dom.tempEmpty.classList.toggle("hidden", entries.length > 0);

  for (const entry of entries) {
    const row = el("div", "list-row");
    row.appendChild(el("span", "list-row-term", entry.term));
    const side = el("div", "list-row-side");
    side.appendChild(el("span", "badge", describeTempDuration(entry)));
    const remove = el("button", "link-danger", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => {
      settingsState.tempMutedTerms = settingsState.tempMutedTerms.filter((item) => item.id !== entry.id);
      renderTempList();
      markDirty();
    });
    side.appendChild(remove);
    row.appendChild(side);
    dom.tempList.appendChild(row);
  }
}

function makeSwitch(checked, label, onToggle, small = false) {
  const button = el("button", `switch${small ? " small" : ""}`);
  button.type = "button";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", String(checked));
  button.setAttribute("aria-label", label);
  button.appendChild(el("span", "knob"));
  button.addEventListener("click", onToggle);
  return button;
}

function addPackDraftTerm(packId) {
  const term = normalizeTerm(packDrafts[packId] || "").toLowerCase();
  if (!term) {
    return;
  }

  const existing = settingsState.packCustomTerms[packId] || [];
  if (!existing.includes(term)) {
    settingsState.packCustomTerms[packId] = [...existing, term];
    analytics.track("pack_custom_term_added", {
      pack_id: PACKS[packId] ? packId : "custom",
      pack_name: getAllPacks()[packId]?.label || "",
      keyword: term,
      custom_term_count_for_pack: settingsState.packCustomTerms[packId].length
    });
  }

  packDrafts[packId] = "";
  renderPacks();
  markDirty();
}

function renderPacks() {
  dom.packList.textContent = "";
  const allPacks = getAllPacks();

  for (const [packId, pack] of Object.entries(allPacks)) {
    const isCustom = Boolean(settingsState.customPacks?.[packId]);
    const isOn = (settingsState.enabledPacks || []).includes(packId);
    const isOpen = openPacks.has(packId);
    const customTerms = settingsState.packCustomTerms?.[packId] || [];

    const card = el("article", `pack-card${isOn ? " on" : ""}`);

    const row = el("div", "pack-row");
    const info = el("div", "pack-info");
    const nameRow = el("div", "pack-name-row");
    nameRow.appendChild(el("span", "pack-name", pack.label));
    if (isCustom) {
      nameRow.appendChild(el("span", "pack-custom-badge", "Custom"));
    }
    info.appendChild(nameRow);
    info.appendChild(el("p", "pack-desc", pack.description || ""));
    row.appendChild(info);

    const openButton = el("button", "pack-open-button", isOpen ? "Hide keywords" : "View keywords");
    openButton.type = "button";
    openButton.setAttribute("aria-expanded", String(isOpen));
    openButton.addEventListener("click", () => {
      if (openPacks.has(packId)) {
        openPacks.delete(packId);
      } else {
        openPacks.add(packId);
      }
      renderPacks();
    });
    row.appendChild(openButton);

    row.appendChild(makeSwitch(isOn, `Enable ${pack.label} pack`, () => {
      if (isOn) {
        settingsState.enabledPacks = settingsState.enabledPacks.filter((id) => id !== packId);
      } else {
        settingsState.enabledPacks = Array.from(new Set([...settingsState.enabledPacks, packId]));
      }
      analytics.track("pack_toggle_changed", {
        pack_id: PACKS[packId] ? packId : "custom",
        enabled: !isOn,
        enabled_pack_count: settingsState.enabledPacks.length
      });
      renderPacks();
      renderOverviewTiles();
      markDirty();
    }));

    card.appendChild(row);

    if (isOpen) {
      const detail = el("div", "pack-detail");

      if ((pack.terms || []).length) {
        const builtInBlock = el("div");
        const builtInLabel = el("p", "pack-detail-label", "Built-in keywords ");
        builtInLabel.appendChild(el("span", "plain", "(can't be edited)"));
        builtInBlock.appendChild(builtInLabel);
        const builtInWrap = el("div", "pack-term-wrap");
        for (const term of pack.terms) {
          builtInWrap.appendChild(el("span", "pack-term", term));
        }
        builtInBlock.appendChild(builtInWrap);
        detail.appendChild(builtInBlock);
      }

      const customBlock = el("div");
      customBlock.appendChild(el("p", "pack-detail-label", "Your added keywords"));
      const customWrap = el("div", "pack-term-wrap");
      if (!customTerms.length) {
        customWrap.appendChild(el("span", "pack-none", "None yet."));
      }
      for (const term of customTerms) {
        const chip = el("span", "pack-custom-chip", term);
        const remove = el("button", "chip-remove", "✕");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${term} from ${pack.label}`);
        remove.addEventListener("click", () => {
          const nextTerms = (settingsState.packCustomTerms[packId] || []).filter((entry) => entry !== term);
          if (nextTerms.length) {
            settingsState.packCustomTerms[packId] = nextTerms;
          } else {
            delete settingsState.packCustomTerms[packId];
          }
          renderPacks();
          markDirty();
        });
        chip.appendChild(remove);
        customWrap.appendChild(chip);
      }
      customBlock.appendChild(customWrap);
      detail.appendChild(customBlock);

      const addRow = el("div", "pack-add-row");
      const input = el("input", "text-input");
      input.type = "text";
      input.placeholder = "Add a keyword…";
      input.setAttribute("aria-label", `Add keyword to ${pack.label}`);
      input.value = packDrafts[packId] || "";
      input.addEventListener("input", () => {
        packDrafts[packId] = input.value;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          addPackDraftTerm(packId);
        }
      });
      addRow.appendChild(input);

      const addButton = el("button", "button-outline", "Add");
      addButton.type = "button";
      addButton.addEventListener("click", () => addPackDraftTerm(packId));
      addRow.appendChild(addButton);

      if (isCustom) {
        const deleteButton = el("button", "link-danger", "Delete pack");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => {
          delete settingsState.customPacks[packId];
          delete settingsState.packCustomTerms[packId];
          settingsState.enabledPacks = settingsState.enabledPacks.filter((id) => id !== packId);
          openPacks.delete(packId);
          renderPacks();
          renderOverviewTiles();
          markDirty();
        });
        addRow.appendChild(deleteButton);
      }

      detail.appendChild(addRow);
      card.appendChild(detail);
    }

    dom.packList.appendChild(card);
  }
}

function renderSiteRules() {
  dom.siteRuleList.textContent = "";
  const rules = settingsState.siteRules || [];
  dom.siteRulesEmpty.classList.toggle("hidden", rules.length > 0);

  for (const rule of rules) {
    const row = el("div", "list-row");
    row.appendChild(el("span", "rule-domain", rule.pattern));

    const modeSelect = el("select", "rule-select");
    modeSelect.setAttribute("aria-label", `Behavior on ${rule.pattern}`);
    for (const [value, label] of [
      ["blur", "Blur references"],
      ["hide", "Hide references"],
      ["placeholder", "Use placeholder"],
      ["page-blur", "Blur whole page"],
      ["off", "Filtering off"]
    ]) {
      const option = el("option", "", label);
      option.value = value;
      modeSelect.appendChild(option);
    }
    modeSelect.value = rule.mode;

    const scopeSelect = el("select", "rule-select");
    scopeSelect.setAttribute("aria-label", `Scope on ${rule.pattern}`);
    for (const [value, label] of [
      ["inline", "Just the reference"],
      ["block", "Whole post"]
    ]) {
      const option = el("option", "", label);
      option.value = value;
      scopeSelect.appendChild(option);
    }
    scopeSelect.value = rule.matchScope || "inline";
    scopeSelect.disabled = rule.mode === "off" || rule.mode === "page-blur";

    modeSelect.addEventListener("change", () => {
      rule.mode = modeSelect.value;
      scopeSelect.disabled = rule.mode === "off" || rule.mode === "page-blur";
      markDirty();
    });
    scopeSelect.addEventListener("change", () => {
      rule.matchScope = scopeSelect.value;
      markDirty();
    });

    row.appendChild(modeSelect);
    row.appendChild(scopeSelect);

    row.appendChild(makeSwitch(rule.enabled !== false, `Rule for ${rule.pattern} enabled`, () => {
      rule.enabled = rule.enabled === false;
      renderSiteRules();
      markDirty();
    }, true));

    const remove = el("button", "link-danger", "Delete");
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete rule for ${rule.pattern}`);
    remove.addEventListener("click", () => {
      settingsState.siteRules = settingsState.siteRules.filter((entry) => entry.id !== rule.id);
      renderSiteRules();
      markDirty();
    });
    row.appendChild(remove);

    dom.siteRuleList.appendChild(row);
  }
}

function renderModeCards() {
  for (const card of dom.modeCards) {
    card.setAttribute("aria-checked", String(card.dataset.mode === settingsState.mode));
  }
  for (const card of dom.scopeCards) {
    card.setAttribute("aria-checked", String(card.dataset.scope === settingsState.matchScope));
  }
  renderPlaceholderCard();
  renderOverviewTiles();
}

function renderPlaceholderCard() {
  const isPlaceholderMode = settingsState.mode === "placeholder";
  dom.placeholderCard.classList.toggle("dimmed", !isPlaceholderMode);
  dom.placeholderNote.textContent = isPlaceholderMode
    ? "Shown instead of the default \"Blocked\" card. Only used in placeholder style."
    : "Only used when your filtering style is \"Swap in a placeholder\" — switch styles above to use it.";

  const hasImage = Boolean(assets.placeholderImage);
  dom.placeholderPreviewRow.classList.toggle("hidden", !hasImage);
  dom.uploadZone.classList.toggle("hidden", hasImage);
  if (hasImage) {
    dom.placeholderPreview.style.setProperty("--placeholder-preview-image", `url("${assets.placeholderImage}")`);
  } else {
    dom.placeholderPreview.style.removeProperty("--placeholder-preview-image");
  }
}

function renderFamilyControls() {
  const pinEnabled = Boolean(settingsState.parentLock?.enabled);
  dom.pinToggle.setAttribute("aria-checked", String(pinEnabled));
  dom.pinConfig.classList.toggle("hidden", !pinEnabled);
  dom.pinKeepNote.classList.toggle("hidden", !settingsState.parentLock?.pinHash);
  dom.lockNowRow.classList.toggle("hidden", !isLockEnabled());

  const selected = Number(settingsState.parentLock?.relockMinutes ?? 0);
  dom.relockOptions.textContent = "";
  for (const option of RELOCK_OPTIONS) {
    const chip = el("button", "relock-chip", option.label);
    chip.type = "button";
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", String(option.minutes === selected));
    chip.addEventListener("click", () => {
      settingsState.parentLock.relockMinutes = option.minutes;
      renderFamilyControls();
      markDirty();
    });
    dom.relockOptions.appendChild(chip);
  }

  const active = RELOCK_OPTIONS.find((option) => option.minutes === selected) || RELOCK_OPTIONS[0];
  dom.relockNote.textContent = active.note;
}

function getTrackedKeywordCount() {
  const packTermCount = (settingsState.enabledPacks || []).reduce((sum, packId) => {
    const pack = getAllPacks()[packId];
    const builtIn = (pack?.terms || []).length;
    const custom = (settingsState.packCustomTerms?.[packId] || []).length;
    return sum + builtIn + custom;
  }, 0);

  return (settingsState.blockedTerms || []).length
    + pruneExpiredTempTerms(settingsState.tempMutedTerms).length
    + packTermCount;
}

function renderStats(stats) {
  statsCache = stats || { totalBlocked: 0, byKeyword: {}, byDay: {}, recent: [] };
  const recent = statsCache.recent || [];
  const byDay = statsCache.byDay || null;

  let blockedToday = 0;
  let blockedWeek = 0;
  if (byDay && Object.keys(byDay).length) {
    const today = new Date();
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const key = day.toISOString().slice(0, 10);
      const count = Number(byDay[key] || 0);
      blockedWeek += count;
      if (offset === 0) {
        blockedToday = count;
      }
    }
  } else {
    const now = Date.now();
    blockedToday = recent.filter((entry) => new Date(entry.timestamp).getTime() >= now - 86400000).length;
    blockedWeek = recent.filter((entry) => new Date(entry.timestamp).getTime() >= now - 7 * 86400000).length;
  }

  dom.statToday.textContent = String(blockedToday);
  dom.statWeek.textContent = String(blockedWeek);
  dom.statTotal.textContent = String(statsCache.totalBlocked || 0);
  dom.statKeywords.textContent = String(getTrackedKeywordCount());

  const topKeyword = Object.entries(statsCache.byKeyword || {}).sort((a, b) => b[1] - a[1])[0];
  dom.statTopKeyword.textContent = topKeyword ? `"${topKeyword[0]}" · ${topKeyword[1]} times` : "—";

  const siteCounts = recent.reduce((accumulator, entry) => {
    accumulator[entry.host] = (accumulator[entry.host] || 0) + 1;
    return accumulator;
  }, {});
  const topSite = Object.entries(siteCounts).sort((a, b) => b[1] - a[1])[0];
  dom.statTopSite.textContent = topSite ? `${topSite[0]} · ${topSite[1]} items` : "—";

  dom.recentList.textContent = "";
  dom.recentEmpty.classList.toggle("hidden", recent.length > 0);
  for (const entry of recent.slice(0, 12)) {
    const row = el("div", "recent-row");
    const term = el("span", "recent-term", `"${entry.term}" `);
    term.appendChild(el("span", "recent-site", `on ${entry.host || "unknown site"}`));
    row.appendChild(term);
    const side = el("div", "recent-side");
    side.appendChild(el("span", "recent-source", entry.source || entry.type || "Blocked"));
    side.appendChild(el("span", "recent-when", timeAgo(entry.timestamp)));
    row.appendChild(side);
    dom.recentList.appendChild(row);
  }
}

function renderAnalyticsToggle() {
  dom.analyticsToggle.setAttribute("aria-checked", String(Boolean(settingsState.shareUsageStats)));
}

function renderAll() {
  renderGlobalStatus();
  renderAnalyticsToggle();
  renderOverviewTiles();
  renderBlocklist();
  renderTempList();
  renderPacks();
  renderSiteRules();
  renderModeCards();
  renderFamilyControls();
  renderLockScreen();
  renderSaveBar();
}

/* ---------- settings load/save ---------- */

function applySettings(rawSettings) {
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
  settingsState.siteRules = settingsState.siteRules || [];

  dom.pinInput.value = "";
  dom.pinConfirm.value = "";
  clearDirty();
  renderAll();
  if (statsCache) {
    renderStats(statsCache);
  }
}

async function validateAndPrepareLock() {
  const enabled = Boolean(settingsState.parentLock?.enabled);
  const relockMinutes = Number(settingsState.parentLock?.relockMinutes || 0);

  if (!enabled) {
    settingsState.parentLock = { enabled: false, pinHash: "", pinSalt: "", relockMinutes };
    await clearUnlockWindow();
    return { ok: true };
  }

  const issue = getSaveIssue();
  if (issue) {
    return { ok: false, message: issue };
  }

  const pin = dom.pinInput.value.trim();
  if (pin) {
    const salt = createSalt();
    const pinHash = await hashPin(pin, salt);
    settingsState.parentLock = { enabled: true, pinHash, pinSalt: salt, relockMinutes };
  } else {
    settingsState.parentLock = { ...settingsState.parentLock, enabled: true, relockMinutes };
  }

  return { ok: true };
}

function collectSettings() {
  return {
    enabled: settingsState.enabled,
    mode: settingsState.mode,
    matchScope: settingsState.matchScope,
    blockedTerms: settingsState.blockedTerms,
    enabledPacks: settingsState.enabledPacks,
    customPacks: settingsState.customPacks,
    packCustomTerms: settingsState.packCustomTerms,
    tempMutedTerms: pruneExpiredTempTerms(settingsState.tempMutedTerms),
    siteRules: settingsState.siteRules,
    shareUsageStats: Boolean(settingsState.shareUsageStats),
    parentLock: settingsState.parentLock
  };
}

async function saveSettings() {
  const lockCheck = await validateAndPrepareLock();
  if (!lockCheck.ok) {
    showToast(lockCheck.message, true);
    return;
  }

  chrome.storage.sync.set({ [STORAGE_KEY]: collectSettings() }, async () => {
    if (chrome.runtime.lastError) {
      showToast("Couldn't save — the list may be too large to sync. Try trimming it.", true);
      return;
    }

    const lockActive = isLockEnabled();
    const relockMinutes = Number(settingsState.parentLock?.relockMinutes || 0);

    dom.pinInput.value = "";
    dom.pinConfirm.value = "";
    clearDirty();

    if (analytics.setConsent) {
      analytics.setConsent(Boolean(settingsState.shareUsageStats));
    }
    analytics.track("settings_saved", {
      ...analytics.summarizeSettings(collectSettings()),
      save_surface: "options",
      relock_behavior: lockActive ? (relockMinutes === 0 ? "immediate" : "timed") : "disabled"
    });

    if (lockActive && relockMinutes === 0) {
      showToast("Changes saved — settings locked");
      await clearUnlockWindow();
    } else {
      if (lockActive) {
        await persistUnlockWindow();
      }
      showToast("Changes saved");
    }

    renderAll();
  });
}

function discardChanges() {
  chrome.storage.sync.get([STORAGE_KEY], (result) => {
    applySettings(result[STORAGE_KEY]);
  });
}

/* ---------- assets ---------- */

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
    if (chrome.runtime.lastError) {
      showToast("Couldn't store the image — it may be too large.", true);
      return;
    }
    renderPlaceholderCard();
    showToast(message);
  });
}

/* ---------- events ---------- */

dom.headerToggle.addEventListener("click", () => {
  settingsState.enabled = !settingsState.enabled;
  renderGlobalStatus();
  markDirty();
});

for (const item of dom.navItems) {
  item.addEventListener("click", () => setSection(item.dataset.section));
}

for (const tile of document.querySelectorAll("[data-goto]")) {
  tile.addEventListener("click", () => setSection(tile.dataset.goto));
}

dom.addTermButton.addEventListener("click", () => {
  const term = normalizeTerm(dom.addTermInput.value);
  if (!term) {
    return;
  }

  const exists = (settingsState.blockedTerms || []).some((entry) => entry.toLowerCase() === term.toLowerCase());
  if (!exists) {
    settingsState.blockedTerms = [...(settingsState.blockedTerms || []), term];
    renderBlocklist();
    renderOverviewTiles();
    markDirty();
  }
  dom.addTermInput.value = "";
  dom.addTermInput.focus();
});

dom.addTermInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    dom.addTermButton.click();
  }
});

dom.addTempButton.addEventListener("click", () => {
  const term = normalizeTerm(dom.tempTermInput.value);
  if (!term) {
    return;
  }

  const now = Date.now();
  const durations = {
    "24h": { label: "24 hours", expiresAt: new Date(now + 86400000).toISOString() },
    "7d": { label: "7 days", expiresAt: new Date(now + 7 * 86400000).toISOString() },
    manual: { label: "Until manually removed", expiresAt: null }
  };
  const selected = durations[dom.tempDuration.value] || durations["24h"];

  settingsState.tempMutedTerms.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    term,
    label: selected.label,
    expiresAt: selected.expiresAt
  });

  dom.tempTermInput.value = "";
  analytics.track("temp_mute_added", {
    duration_selected: dom.tempDuration.value,
    temp_mute_count: settingsState.tempMutedTerms.length
  });
  renderTempList();
  markDirty();
});

dom.tempTermInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    dom.addTempButton.click();
  }
});

dom.newPackToggle.addEventListener("click", () => {
  dom.newPackForm.classList.toggle("hidden");
  dom.npError.classList.add("hidden");
});

dom.cancelPackButton.addEventListener("click", () => {
  dom.newPackForm.classList.add("hidden");
  dom.npError.classList.add("hidden");
});

dom.createPackButton.addEventListener("click", () => {
  const label = normalizeTerm(dom.npName.value);
  const description = normalizeTerm(dom.npDesc.value);
  const terms = parseTermsInput(dom.npTerms.value);
  const packIdBase = normalizePackId(label);

  const fail = (message) => {
    dom.npError.textContent = message;
    dom.npError.classList.remove("hidden");
  };

  if (!label) {
    return fail("Give your pack a name.");
  }
  if (!packIdBase) {
    return fail("The pack name needs letters or numbers.");
  }
  if (!terms.length) {
    return fail("Add at least one keyword.");
  }

  let packId = `custom_${packIdBase}`;
  let suffix = 2;
  while (getAllPacks()[packId]) {
    packId = `custom_${packIdBase}_${suffix}`;
    suffix += 1;
  }

  settingsState.customPacks[packId] = {
    label,
    description: description || "Your custom pack.",
    terms
  };
  settingsState.enabledPacks = Array.from(new Set([...settingsState.enabledPacks, packId]));
  openPacks.add(packId);

  dom.npName.value = "";
  dom.npDesc.value = "";
  dom.npTerms.value = "";
  dom.npError.classList.add("hidden");
  dom.newPackForm.classList.add("hidden");

  analytics.track("custom_pack_created", {
    pack_name: label,
    initial_term_count: terms.length,
    enabled_pack_count: settingsState.enabledPacks.length,
    custom_pack_count: Object.keys(settingsState.customPacks).length
  });
  for (const term of terms) {
    analytics.track("pack_custom_term_added", {
      pack_id: "custom",
      pack_name: label,
      keyword: term,
      custom_term_count_for_pack: terms.length
    });
  }

  renderPacks();
  renderOverviewTiles();
  markDirty();
});

dom.addRuleButton.addEventListener("click", () => {
  const domain = normalizeTerm(dom.siteDomain.value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!domain) {
    return;
  }

  const exists = (settingsState.siteRules || []).some((rule) => rule.pattern === domain);
  if (!exists) {
    settingsState.siteRules.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pattern: domain,
      mode: settingsState.mode,
      matchScope: settingsState.matchScope,
      enabled: true
    });
    analytics.track("site_rule_added", {
      mode_selected: settingsState.mode,
      scope_selected: settingsState.matchScope,
      site_rule_count: settingsState.siteRules.length
    });
    renderSiteRules();
    markDirty();
  }
  dom.siteDomain.value = "";
});

dom.siteDomain.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    dom.addRuleButton.click();
  }
});

function bindOptionCards(cards, datasetKey, apply) {
  for (const card of cards) {
    const pick = () => {
      apply(card.dataset[datasetKey]);
      renderModeCards();
      markDirty();
    };
    card.addEventListener("click", pick);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pick();
      }
    });
  }
}

bindOptionCards(dom.modeCards, "mode", (value) => {
  settingsState.mode = value;
});
bindOptionCards(dom.scopeCards, "scope", (value) => {
  settingsState.matchScope = value;
});

dom.placeholderImageInput.addEventListener("change", async (event) => {
  const [file] = Array.from(event.target.files || []);
  if (!file) {
    return;
  }

  try {
    assets.placeholderImage = await readFileAsDataUrl(file);
    dom.placeholderImageInput.value = "";
    saveAssets("Placeholder image saved");
  } catch (_error) {
    showToast("That image couldn't be loaded.", true);
  }
});

dom.removeImageButton.addEventListener("click", () => {
  assets.placeholderImage = "";
  saveAssets("Placeholder image removed");
});

dom.pinToggle.addEventListener("click", () => {
  const next = !settingsState.parentLock?.enabled;
  settingsState.parentLock = {
    ...settingsState.parentLock,
    enabled: next,
    ...(next ? {} : { pinHash: "", pinSalt: "" })
  };
  dom.pinInput.value = "";
  dom.pinConfirm.value = "";
  renderFamilyControls();
  markDirty();
});

for (const input of [dom.pinInput, dom.pinConfirm]) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");
    markDirty();
  });
}

dom.lockNowButton.addEventListener("click", () => {
  clearUnlockWindow();
});

dom.analyticsToggle.addEventListener("click", () => {
  settingsState.shareUsageStats = !settingsState.shareUsageStats;
  renderAnalyticsToggle();
  markDirty();
});

dom.unlockButton.addEventListener("click", async () => {
  const pin = dom.unlockPin.value.trim();
  if (!pin) {
    dom.unlockError.textContent = "Enter the PIN.";
    dom.unlockError.classList.remove("hidden");
    return;
  }

  await unlockWithPin(pin);
});

dom.unlockPin.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    dom.unlockButton.click();
  }
});

dom.unlockPin.addEventListener("input", () => {
  dom.unlockPin.value = dom.unlockPin.value.replace(/\D/g, "");
});

dom.resetStatsButton.addEventListener("click", () => {
  chrome.storage.local.set({
    [STATS_STORAGE_KEY]: {
      totalBlocked: 0,
      byKeyword: {},
      byDay: {},
      recent: [],
      lastUpdated: new Date().toISOString()
    }
  }, () => {
    renderStats(null);
    showToast("History reset");
  });
});

dom.saveButton.addEventListener("click", saveSettings);
dom.discardButton.addEventListener("click", discardChanges);

for (const trigger of document.querySelectorAll(".help-dot")) {
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const help = HELP_CONTENT[trigger.dataset.help];
    if (!help) {
      return;
    }

    dom.helpTitle.textContent = help.title;
    dom.helpCopy.textContent = help.copy;
    dom.helpImage.src = help.image;
    dom.helpImage.alt = help.title;
    dom.helpModal.showModal();
  });
}

dom.helpClose.addEventListener("click", () => dom.helpModal.close());

dom.helpModal.addEventListener("click", (event) => {
  if (event.target === dom.helpModal) {
    dom.helpModal.close();
  }
});

window.addEventListener("hashchange", () => {
  setSection(location.hash.replace(/^#/, ""));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    if (!isDirty()) {
      applySettings(changes[STORAGE_KEY].newValue);
    } else {
      const incoming = changes[STORAGE_KEY].newValue || {};
      if (typeof incoming.enabled === "boolean" && incoming.enabled !== settingsState.enabled) {
        settingsState.enabled = incoming.enabled;
        renderGlobalStatus();
        renderSaveBar();
      }
    }
  }

  if (areaName === "local" && changes[STATS_STORAGE_KEY]) {
    renderStats(changes[STATS_STORAGE_KEY].newValue);
  }

  if (areaName === "local" && changes[ASSETS_STORAGE_KEY]) {
    assets = { ...assets, ...(changes[ASSETS_STORAGE_KEY].newValue || {}) };
    renderPlaceholderCard();
  }

  if (areaName === "local" && changes[LOCK_STATE_KEY]) {
    lockState = { unlockedUntil: changes[LOCK_STATE_KEY].newValue?.unlockedUntil || 0 };
    renderLockScreen();
    scheduleRelockTimer();
  }
});

/* ---------- init ---------- */

async function init() {
  if (typeof chrome !== "undefined" && chrome.runtime?.id) {
    const storeUrl = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`;
    dom.rateLink.href = storeUrl;
    dom.rateLinkSupport.href = storeUrl;
    const manifest = chrome.runtime.getManifest();
    dom.versionLabel.textContent = `Cancel It v${manifest.version}`;
  }

  const syncResult = await chrome.storage.sync.get([STORAGE_KEY]);
  const localResult = await chrome.storage.local.get([STATS_STORAGE_KEY, ASSETS_STORAGE_KEY, LOCK_STATE_KEY]);

  assets = { ...assets, ...(localResult[ASSETS_STORAGE_KEY] || {}) };
  lockState = { unlockedUntil: localResult[LOCK_STATE_KEY]?.unlockedUntil || 0 };

  applySettings(syncResult[STORAGE_KEY]);
  renderStats(localResult[STATS_STORAGE_KEY]);
  scheduleRelockTimer();
  setSection(location.hash.replace(/^#/, "") || "overview");
}

init();
