const STORAGE_KEY = "cancelItSettings";
const LOCK_STATE_KEY = "cancelItLockState";
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "blur",
  matchScope: "inline",
  parentLock: {
    enabled: false,
    pinHash: "",
    pinSalt: "",
    relockMinutes: 0
  }
};

const enabledInput = document.getElementById("popup-enabled");
const modeInput = document.getElementById("popup-mode");
const scopeInput = document.getElementById("popup-scope");
const saveButton = document.getElementById("save-popup");
const openOptionsButton = document.getElementById("open-options");
const siteStatusNode = document.getElementById("site-status");
const popupLockScreen = document.getElementById("popup-lock-screen");
const popupUnlockPinInput = document.getElementById("popup-unlock-pin");
const popupUnlockButton = document.getElementById("popup-unlock");
const popupLockStatusNode = document.getElementById("popup-lock-status");
const analytics = window.CancelItAnalytics || { track: () => null, summarizeSettings: () => ({}) };
let currentSettings = structuredClone(DEFAULT_SETTINGS);
let lockState = { unlockedUntil: 0 };

async function getCurrentHostname() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      return "";
    }

    const url = new URL(tab.url);
    return url.hostname;
  } catch (_error) {
    return "";
  }
}

function applySettings(settings) {
  currentSettings = settings;
  enabledInput.checked = settings.enabled;
  modeInput.value = settings.mode || DEFAULT_SETTINGS.mode;
  scopeInput.value = settings.matchScope || DEFAULT_SETTINGS.matchScope;
}

function isLockEnabled() {
  return currentSettings.parentLock?.enabled && currentSettings.parentLock?.pinHash;
}

function isCurrentlyUnlocked() {
  if (!isLockEnabled()) {
    return true;
  }

  return Boolean(lockState.unlockedUntil && lockState.unlockedUntil > Date.now());
}

function setLockedUi() {
  const locked = !isCurrentlyUnlocked();
  popupLockScreen.classList.toggle("hidden", !locked);
  enabledInput.disabled = locked;
  modeInput.disabled = locked;
  scopeInput.disabled = locked;
  saveButton.disabled = locked;
}

async function sha256(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function unlockPopup(pin) {
  const salt = currentSettings.parentLock?.pinSalt;
  const expected = currentSettings.parentLock?.pinHash;
  const computed = await sha256(`${salt}:${pin}`);
  if (computed !== expected) {
    popupLockStatusNode.textContent = "Incorrect PIN.";
    return;
  }

  const minutes = Number(currentSettings.parentLock?.relockMinutes || 0);
  lockState = { unlockedUntil: minutes === 0 ? Date.now() : Date.now() + minutes * 60 * 1000 };
  chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState }, () => {
    popupUnlockPinInput.value = "";
    popupLockStatusNode.textContent = "";
    setLockedUi();
  });
}

chrome.storage.sync.get([STORAGE_KEY], async (result) => {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(result[STORAGE_KEY] || {}),
    parentLock: {
      ...DEFAULT_SETTINGS.parentLock,
      ...(result[STORAGE_KEY]?.parentLock || {})
    }
  };
  applySettings(settings);
  const localResult = await chrome.storage.local.get([LOCK_STATE_KEY]);
  lockState = { unlockedUntil: localResult[LOCK_STATE_KEY]?.unlockedUntil || 0 };
  setLockedUi();
  const hostname = await getCurrentHostname();
  siteStatusNode.textContent = hostname ? `Current site: ${hostname}` : "Current site unavailable";
});

saveButton.addEventListener("click", () => {
  chrome.storage.sync.get([STORAGE_KEY], (result) => {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(result[STORAGE_KEY] || {}),
      enabled: enabledInput.checked,
      mode: modeInput.value,
      matchScope: scopeInput.value
    };

    chrome.storage.sync.set({ [STORAGE_KEY]: merged }, () => {
      analytics.track("settings_saved", {
        ...analytics.summarizeSettings(merged),
        save_surface: "popup",
        relock_behavior: merged.parentLock?.enabled
          ? (Number(merged.parentLock?.relockMinutes || 0) === 0 ? "immediate" : "timed")
          : "disabled"
      });
      saveButton.textContent = "Saved";
      if (currentSettings.parentLock?.enabled && Number(currentSettings.parentLock?.relockMinutes || 0) === 0) {
        lockState = { unlockedUntil: 0 };
        chrome.storage.local.set({ [LOCK_STATE_KEY]: lockState }, setLockedUi);
      }
      window.setTimeout(() => {
        saveButton.textContent = "Save";
      }, 1200);
    });
  });
});

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

popupUnlockButton.addEventListener("click", async () => {
  if (!popupUnlockPinInput.value.trim()) {
    popupLockStatusNode.textContent = "Enter PIN.";
    return;
  }

  await unlockPopup(popupUnlockPinInput.value.trim());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[LOCK_STATE_KEY]) {
    lockState = { unlockedUntil: changes[LOCK_STATE_KEY].newValue?.unlockedUntil || 0 };
    setLockedUi();
  }
});
