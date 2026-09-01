/* Preview-only stub of the chrome.* extension APIs with sample data. */
(function () {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const dayKey = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };

  const syncData = {
    cancelItSettings: {
      enabled: true,
      mode: "blur",
      matchScope: "block",
      blockedTerms: ["Jennifer Lopez", "porn", "pornography"],
      enabledPacks: ["celebrity_gossip", "politics"],
      customPacks: {
        custom_true_crime: {
          label: "True Crime",
          description: "Podcast recaps and case-file deep dives.",
          terms: ["true crime", "cold case", "unsolved mystery"]
        }
      },
      packCustomTerms: { celebrity_gossip: ["met gala"] },
      tempMutedTerms: [
        { id: "t1", term: "Oscars 2026", label: "7 days", expiresAt: iso(-6 * 86400000) },
        { id: "t2", term: "Election polls", label: "24 hours", expiresAt: iso(-8 * 3600000) }
      ],
      siteRules: [
        { id: "r1", pattern: "facebook.com", mode: "hide", matchScope: "block", enabled: true },
        { id: "r2", pattern: "wikipedia.org", mode: "off", matchScope: "inline", enabled: true }
      ],
      focusMode: { blockedSites: [], active: false, sessionEndsAt: null },
      parentLock: { enabled: false, pinHash: "", pinSalt: "", relockMinutes: 5 }
    }
  };

  const localData = {
    cancelItStats: {
      totalBlocked: 1284,
      byKeyword: { election: 212, "red carpet": 96, "jennifer lopez": 44 },
      byDay: { [dayKey(0)]: 37, [dayKey(1)]: 41, [dayKey(2)]: 28, [dayKey(3)]: 30, [dayKey(4)]: 26, [dayKey(5)]: 33, [dayKey(6)]: 19 },
      recent: [
        { term: "red carpet", source: "Celebrity Gossip pack", type: "text", host: "x.com", timestamp: iso(2 * 60000) },
        { term: "jennifer lopez", source: "Manual blocklist", type: "text", host: "news.google.com", timestamp: iso(18 * 60000) },
        { term: "campaign", source: "Politics pack", type: "structured-container", host: "facebook.com", timestamp: iso(3600000) },
        { term: "oscars 2026", source: "Temporary mute", type: "text", host: "youtube.com", timestamp: iso(3 * 3600000) }
      ]
    },
    cancelItAssets: { placeholderImage: "" },
    cancelItLockState: { unlockedUntil: 0 },
    cancelItPageSummaries: {
      "https://www.facebook.com/": {
        url: "https://www.facebook.com/",
        host: "facebook.com",
        totalBlocked: 12,
        reasons: { "Politics pack": 7, "Manual blocklist": 4, "Temporary mute": 1 },
        lastUpdated: iso(60000)
      }
    }
  };

  const changeListeners = [];

  function makeArea(data, areaName) {
    return {
      get(keys, cb) {
        const out = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          if (key in data) out[key] = JSON.parse(JSON.stringify(data[key]));
        }
        if (cb) cb(out);
        return Promise.resolve(out);
      },
      set(items, cb) {
        const changes = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { oldValue: data[key], newValue: JSON.parse(JSON.stringify(value)) };
        }
        Object.assign(data, JSON.parse(JSON.stringify(items)));
        if (cb) cb();
        // Fire onChanged async, like real Chrome does.
        setTimeout(() => {
          for (const listener of changeListeners) listener(changes, areaName);
        }, 0);
        return Promise.resolve();
      }
    };
  }

  window.chrome = {
    storage: {
      sync: makeArea(syncData, "sync"),
      local: makeArea(localData, "local"),
      onChanged: { addListener(fn) { changeListeners.push(fn); } }
    },
    runtime: {
      id: "preview-extension-id",
      lastError: undefined,
      getManifest: () => ({ version: "0.2.0" }),
      openOptionsPage: () => alert("openOptionsPage()"),
      getURL: (p) => p
    },
    tabs: {
      query: () => Promise.resolve([{ url: "https://www.facebook.com/" }]),
      create: (opts) => alert("tabs.create " + opts.url)
    }
  };
})();
