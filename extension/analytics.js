(function initCancelItAnalytics() {
  const config = window.CANCEL_IT_FIREBASE_CONFIG || {};
  const settings = window.CANCEL_IT_ANALYTICS_SETTINGS || {};
  let warned = false;

  function isConfigured() {
    return Boolean(
      settings.enabled &&
      config.apiKey &&
      config.projectId &&
      config.appId &&
      config.measurementId
    );
  }

  function sanitizeParams(params) {
    const next = {};

    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        next[key] = value;
        continue;
      }

      if (Array.isArray(value)) {
        next[key] = value.join(",");
      }
    }

    return next;
  }

  function warnConfigMode() {
    if (warned || isConfigured()) {
      return;
    }

    warned = true;
    console.info(
      "[Cancel It analytics] Config shell wired. Firebase transport not active yet. " +
      "Add keys in firebase-config.js, then finish SDK or server-side transport."
    );
  }

  function track(eventName, params = {}) {
    warnConfigMode();

    return {
      eventName,
      params: sanitizeParams(params),
      configured: isConfigured(),
      provider: settings.provider || "firebase",
      mode: settings.mode || "config-only"
    };
  }

  function summarizeSettings(settingsState) {
    const enabledPacks = settingsState.enabledPacks || [];
    const packCustomTerms = settingsState.packCustomTerms || {};
    const siteRules = settingsState.siteRules || [];
    const parentLock = settingsState.parentLock || {};

    return {
      filtering_enabled: Boolean(settingsState.enabled),
      mode_selected: settingsState.mode || "blur",
      scope_selected: settingsState.matchScope || "inline",
      enabled_pack_count: enabledPacks.length,
      enabled_pack_ids: enabledPacks.slice().sort(),
      custom_pack_term_count: Object.values(packCustomTerms).reduce((sum, terms) => sum + terms.length, 0),
      site_rule_count: siteRules.length,
      site_rule_modes: Array.from(new Set(siteRules.map((rule) => rule.mode))).sort(),
      parent_lock_enabled: Boolean(parentLock.enabled),
      relock_minutes: Number(parentLock.relockMinutes || 0),
      blocked_term_count: (settingsState.blockedTerms || []).length,
      temp_mute_count: (settingsState.tempMutedTerms || []).length
    };
  }

  window.CancelItAnalytics = {
    isConfigured,
    track,
    summarizeSettings
  };
})();
