(function initCancelItAnalytics() {
  const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
  const GA_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";
  const CLIENT_ID_KEY = "cancelItAnalyticsClientId";
  const SETTINGS_KEY = "cancelItSettings";
  const BUILT_IN_PACK_IDS = new Set([
    "celebrity_gossip",
    "politics",
    "crypto_hype",
    "sports_spoilers",
    "adult_content",
    "family_safe",
    "ragebait"
  ]);

  const config = window.CANCEL_IT_FIREBASE_CONFIG || {};
  const settings = window.CANCEL_IT_ANALYTICS_SETTINGS || {};
  // GA4 groups events into sessions; one popup/options page load = one session.
  const sessionId = String(Date.now());

  let consent = false;
  let consentReady = false;
  let pendingEvents = [];
  let clientIdPromise = null;

  function hasChrome() {
    return typeof chrome !== "undefined" && Boolean(chrome.storage);
  }

  function isConfigured() {
    return Boolean(settings.enabled && config.measurementId && config.apiSecret);
  }

  function getClientId() {
    if (!clientIdPromise) {
      clientIdPromise = new Promise((resolve) => {
        chrome.storage.local.get([CLIENT_ID_KEY], (result) => {
          const existing = result[CLIENT_ID_KEY];
          if (existing) {
            resolve(existing);
            return;
          }

          const fresh = crypto.randomUUID();
          chrome.storage.local.set({ [CLIENT_ID_KEY]: fresh }, () => resolve(fresh));
        });
      });
    }

    return clientIdPromise;
  }

  function sanitizeParams(params) {
    const next = {};

    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === "string") {
        // GA4 caps event param values at 100 characters.
        next[key] = value.slice(0, 100);
        continue;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        next[key] = value;
        continue;
      }

      if (Array.isArray(value)) {
        next[key] = value.join(",").slice(0, 100);
      }
    }

    return next;
  }

  async function send(eventName, params) {
    const clientId = await getClientId();
    const endpoint = settings.debug ? GA_DEBUG_ENDPOINT : GA_ENDPOINT;
    const url = `${endpoint}?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;
    const body = JSON.stringify({
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          session_id: sessionId,
          engagement_time_msec: 100,
          extension_version: chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : "",
          ...params
        }
      }]
    });

    const response = await fetch(url, { method: "POST", body });
    if (settings.debug) {
      const validation = await response.json().catch(() => null);
      console.info("[Cancel It analytics] debug validation:", validation);
    }
  }

  function dispatch(eventName, params) {
    if (!consent || !isConfigured()) {
      return;
    }

    send(eventName, params).catch(() => null);
  }

  function track(eventName, params = {}) {
    const payload = {
      eventName,
      params: sanitizeParams(params),
      configured: isConfigured(),
      consented: consent
    };

    if (!isConfigured() || !hasChrome()) {
      if (settings.debug && !isConfigured()) {
        console.info("[Cancel It analytics] not configured — set apiSecret in firebase-config.js");
      }
      return payload;
    }

    if (!consentReady) {
      // Consent is loaded async from storage on startup; hold early events
      // briefly instead of dropping them.
      if (pendingEvents.length < 20) {
        pendingEvents.push({ eventName, params: payload.params });
      }
      return payload;
    }

    dispatch(eventName, payload.params);
    return payload;
  }

  function flushPending() {
    const events = pendingEvents.splice(0, pendingEvents.length);
    for (const event of events) {
      dispatch(event.eventName, event.params);
    }
  }

  // Options page calls this right after saving so the opt-in save itself
  // is captured without waiting for the storage.onChanged round-trip.
  function setConsent(value) {
    consent = Boolean(value);
    consentReady = true;
    flushPending();
  }

  function summarizeSettings(settingsState) {
    const enabledPacks = settingsState.enabledPacks || [];
    const builtInEnabled = enabledPacks.filter((id) => BUILT_IN_PACK_IDS.has(id));
    const packCustomTerms = settingsState.packCustomTerms || {};
    const siteRules = settingsState.siteRules || [];
    const parentLock = settingsState.parentLock || {};

    return {
      filtering_enabled: Boolean(settingsState.enabled),
      mode_selected: settingsState.mode || "blur",
      scope_selected: settingsState.matchScope || "inline",
      enabled_pack_count: enabledPacks.length,
      // Built-in ids only — custom pack ids embed user-typed names.
      enabled_pack_ids: builtInEnabled.slice().sort(),
      enabled_custom_pack_count: enabledPacks.length - builtInEnabled.length,
      custom_pack_term_count: Object.values(packCustomTerms).reduce((sum, terms) => sum + terms.length, 0),
      site_rule_count: siteRules.length,
      site_rule_modes: Array.from(new Set(siteRules.map((rule) => rule.mode))).sort(),
      parent_lock_enabled: Boolean(parentLock.enabled),
      relock_minutes: Number(parentLock.relockMinutes || 0),
      blocked_term_count: (settingsState.blockedTerms || []).length,
      temp_mute_count: (settingsState.tempMutedTerms || []).length,
      image_detection_enabled: Boolean(settingsState.imageDetection?.enabled),
      share_usage_stats: Boolean(settingsState.shareUsageStats)
    };
  }

  if (hasChrome()) {
    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      consent = Boolean(result[SETTINGS_KEY]?.shareUsageStats);
      consentReady = true;
      flushPending();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync" && changes[SETTINGS_KEY]) {
        consent = Boolean(changes[SETTINGS_KEY].newValue?.shareUsageStats);
        consentReady = true;
      }
    });
  }

  window.CancelItAnalytics = {
    isConfigured,
    track,
    setConsent,
    summarizeSettings
  };
})();
