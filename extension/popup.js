const STORAGE_KEY = "cancelItSettings";
const LOCK_STATE_KEY = "cancelItLockState";
const PAGE_SUMMARY_STORAGE_KEY = "cancelItPageSummaries";
const IMMEDIATE_RELOCK_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "blur",
  matchScope: "inline",
  enabledPacks: [],
  shareUsageStats: false,
  parentLock: {
    enabled: false,
    pinHash: "",
    pinSalt: "",
    relockMinutes: 0
  }
};

const toggleButton = document.getElementById("popup-toggle");
const lockedView = document.getElementById("popup-locked");
const mainView = document.getElementById("popup-main");
const heroNode = document.getElementById("popup-hero");
const headlineNode = document.getElementById("popup-headline");
const subNode = document.getElementById("popup-sub");
const siteRowNode = document.getElementById("popup-site-row");
const siteNode = document.getElementById("popup-site");
const blocksNode = document.getElementById("popup-blocks");
const countNode = document.getElementById("popup-count");
const chipsNode = document.getElementById("popup-chips");
const openOptionsButton = document.getElementById("open-options");
const pinInput = document.getElementById("popup-pin");
const pinErrorNode = document.getElementById("popup-pin-error");
const unlockButton = document.getElementById("popup-unlock");
const rateLink = document.getElementById("rate-link");
const supportLink = document.getElementById("support-link");
const analytics = window.CancelItAnalytics || { track: () => null, summarizeSettings: () => ({}) };

let currentSettings = structuredClone(DEFAULT_SETTINGS);
let lockState = { unlockedUntil: 0 };
let currentTabUrl = "";
let currentSummary = null;

function mergeSettings(raw) {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...(raw || {}),
    parentLock: {
      ...structuredClone(DEFAULT_SETTINGS.parentLock),
      ...(raw?.parentLock || {})
    }
  };
}

async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url || tab.url.startsWith("chrome-extension://")) {
      return null;
    }

    currentTabUrl = tab.url;
    return new URL(tab.url);
  } catch (_error) {
    currentTabUrl = "";
    return null;
  }
}

async function loadCurrentPageSummary() {
  if (!currentTabUrl) {
    return null;
  }

  const result = await chrome.storage.local.get([PAGE_SUMMARY_STORAGE_KEY]);
  const summaries = result[PAGE_SUMMARY_STORAGE_KEY] || {};
  return summaries[currentTabUrl] || null;
}

function isLockEnabled() {
  return Boolean(currentSettings.parentLock?.enabled && currentSettings.parentLock?.pinHash);
}

function isCurrentlyUnlocked() {
  if (!isLockEnabled()) {
    return true;
  }

  return Boolean(lockState.unlockedUntil && lockState.unlockedUntil > Date.now());
}

function describeWatchTargets() {
  const packCount = (currentSettings.enabledPacks || []).length;
  if (packCount === 0) {
    return "Watching for your blocklist.";
  }

  return `Watching for ${packCount} pack${packCount === 1 ? "" : "s"} and your blocklist.`;
}

function renderHero() {
  const enabled = Boolean(currentSettings.enabled);
  heroNode.classList.toggle("paused", !enabled);
  toggleButton.setAttribute("aria-checked", String(enabled));
  headlineNode.textContent = enabled ? "Filtering is on" : "Filtering is paused";
  subNode.textContent = enabled
    ? describeWatchTargets()
    : "You're seeing everything. Flip the switch to resume.";
}

function renderSummary() {
  const summary = currentSummary;
  const totalBlocked = Number(summary?.totalBlocked || 0);
  const reasons = summary?.reasons || {};
  const hasBlocks = currentSettings.enabled && totalBlocked > 0;

  blocksNode.classList.toggle("hidden", !hasBlocks);
  if (!hasBlocks) {
    if (currentSettings.enabled && currentTabUrl) {
      subNode.textContent = summary
        ? "Nothing on this page matched your list."
        : describeWatchTargets();
    }
    return;
  }

  countNode.textContent = `${totalBlocked} item${totalBlocked === 1 ? "" : "s"} filtered on this page`;
  chipsNode.textContent = "";
  const sortedReasons = Object.entries(reasons).sort((left, right) => right[1] - left[1]);
  for (const [label, count] of sortedReasons) {
    const chip = document.createElement("span");
    chip.className = "popup-chip";
    chip.textContent = `${label} · ${count}`;
    chipsNode.appendChild(chip);
  }
}

function renderLockState() {
  const locked = !isCurrentlyUnlocked();
  lockedView.classList.toggle("hidden", !locked);
  mainView.classList.toggle("hidden", locked);
  toggleButton.classList.toggle("hidden", locked);
  if (!locked) {
    pinInput.value = "";
    pinErrorNode.classList.add("hidden");
  }
}

function render() {
  renderHero();
  renderSummary();
  renderLockState();
}

async function sha256(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function showPinError(message) {
  pinErrorNode.textContent = message;
  pinErrorNode.classList.remove("hidden");
}

async function unlockPopup(pin) {
  const salt = currentSettings.parentLock?.pinSalt;
  const expected = currentSettings.parentLock?.pinHash;
  const computed = await sha256(`${salt}:${pin}`);
  if (computed !== expected) {
    showPinError("That PIN doesn't match.");
    pinInput.value = "";
    return;
  }

  const minutes = Number(currentSettings.parentLock?.relockMinutes || 0);
  const windowMs = minutes === 0 ? IMMEDIATE_RELOCK_WINDOW_MS : minutes * 60 * 1000;
  lockState = { unlockedUntil: Date.now() + windowMs };
  chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState }, () => {
    render();
  });
}

function persistEnabled(enabled) {
  chrome.storage.sync.get([STORAGE_KEY], (result) => {
    const merged = { ...(result[STORAGE_KEY] || {}), enabled };
    chrome.storage.sync.set({ [STORAGE_KEY]: merged }, () => {
      if (chrome.runtime.lastError) {
        currentSettings.enabled = !enabled;
        render();
        return;
      }

      analytics.track("filtering_toggled", {
        ...analytics.summarizeSettings(mergeSettings(merged)),
        toggle_surface: "popup"
      });
    });
  });
}

toggleButton.addEventListener("click", () => {
  if (!isCurrentlyUnlocked()) {
    return;
  }

  currentSettings.enabled = !currentSettings.enabled;
  render();
  persistEnabled(currentSettings.enabled);
});

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

supportLink.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html#support") });
});

unlockButton.addEventListener("click", async () => {
  const pin = pinInput.value.trim();
  if (!pin) {
    showPinError("Enter the PIN.");
    return;
  }

  await unlockPopup(pin);
});

pinInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    unlockButton.click();
  }
});

pinInput.addEventListener("input", () => {
  pinInput.value = pinInput.value.replace(/\D/g, "");
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    currentSettings = mergeSettings(changes[STORAGE_KEY].newValue);
    render();
  }

  if (areaName === "local" && changes[LOCK_STATE_KEY]) {
    lockState = { unlockedUntil: changes[LOCK_STATE_KEY].newValue?.unlockedUntil || 0 };
    render();
  }

  if (areaName === "local" && changes[PAGE_SUMMARY_STORAGE_KEY]) {
    const summaries = changes[PAGE_SUMMARY_STORAGE_KEY].newValue || {};
    currentSummary = currentTabUrl ? summaries[currentTabUrl] || null : null;
    render();
  }
});

async function init() {
  if (chrome.runtime?.id) {
    rateLink.href = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`;
  }

  const syncResult = await chrome.storage.sync.get([STORAGE_KEY]);
  currentSettings = mergeSettings(syncResult[STORAGE_KEY]);

  const localResult = await chrome.storage.local.get([LOCK_STATE_KEY]);
  lockState = { unlockedUntil: localResult[LOCK_STATE_KEY]?.unlockedUntil || 0 };

  const tabUrl = await getCurrentTab();
  siteRowNode.classList.toggle("hidden", !tabUrl);
  siteNode.textContent = tabUrl ? tabUrl.hostname : "—";

  currentSummary = await loadCurrentPageSummary();
  render();
}

init();
