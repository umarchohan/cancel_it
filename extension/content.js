const STORAGE_KEY = "cancelItSettings";
const STATS_STORAGE_KEY = "cancelItStats";
const ASSETS_STORAGE_KEY = "cancelItAssets";
const PAGE_SUMMARY_STORAGE_KEY = "cancelItPageSummaries";
const PACKS = {
  celebrity_gossip: ["celebrity gossip", "tmz", "paparazzi", "red carpet", "tabloid", "jennifer lopez"],
  politics: ["election", "campaign", "senate", "congress", "white house", "politics"],
  crypto_hype: ["bitcoin", "ethereum", "solana", "memecoin", "crypto", "nft"],
  sports_spoilers: ["final score", "match winner", "spoiler", "knockout", "highlights", "game recap"],
  adult_content: ["porn", "pornography", "nsfw", "explicit", "adult video", "onlyfans"],
  family_safe: ["porn", "nsfw", "explicit", "gore", "violent", "graphic violence", "adult content"],
  ragebait: ["you won't believe", "meltdown", "ratioed", "destroyed", "exposed", "viral outrage"],
  ai_hype: ["chatgpt", "ai-generated", "artificial intelligence", "generative ai", "ai hype", "prompt engineering"],
  reality_tv: ["reality tv", "reality show", "love island", "bachelor nation", "rose ceremony", "elimination episode"]
};
const PACK_LABELS = {
  celebrity_gossip: "Celebrity Gossip pack",
  politics: "Politics pack",
  crypto_hype: "Crypto Hype pack",
  sports_spoilers: "Sports Spoilers pack",
  adult_content: "Adult Content pack",
  family_safe: "Family Safe pack",
  ragebait: "Ragebait pack",
  ai_hype: "AI Hype pack",
  reality_tv: "Reality TV pack"
};
const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "blur",
  matchScope: "inline",
  blockedTerms: [
    "jennifer lopez",
    "porn",
    "pornography"
  ],
  enabledPacks: [],
  customPacks: {},
  packCustomTerms: {},
  tempMutedTerms: [],
  siteRules: [],
  focusMode: {
    blockedSites: [],
    active: false,
    sessionEndsAt: null
  }
};

const STYLE_ID = "cancel-it-styles";
const FOCUS_OVERLAY_ID = "cancel-it-focus-overlay";
const FLAG_ATTR = "data-cancel-it-blocked";
const REASON_ATTR = "data-cancel-it-reason";
const LABEL_ATTR = "data-cancel-it-label";
const TEXT_WRAPPER_ATTR = "data-cancel-it-text-wrapper";
const PAGE_FLAG_ATTR = "data-cancel-it-page-blocked";
const IMG_SELECTOR = "img, picture, video, svg, canvas";
const MEDIA_CONTAINER_SELECTOR = "a, button, [role='button'], [role='link']";
const FACEBOOK_CONTAINER_SELECTOR = [
  "[role='feed'] [role='article']",
  "[data-pagelet] [role='article']",
  "[role='main'] [role='article']",
  "[data-pagelet*='FeedUnit']",
  "[data-pagelet*='Stories']",
  "[data-pagelet*='VideoChat']"
].join(", ");
const LINKEDIN_CONTAINER_SELECTOR = [
  ".feed-shared-update-v2",
  ".occludable-update",
  ".scaffold-finite-scroll__content > div",
  ".search-results-container .reusable-search__result-container",
  ".jobs-search-results__list-item"
].join(", ");
const FACEBOOK_HIDE_TARGET_SELECTOR = [
  "[role='feed'] [role='article']",
  "[role='main'] [role='article']",
  "[data-pagelet] [role='article']",
  "[data-pagelet*='FeedUnit']",
  "[data-pagelet*='VideoChat']",
  "[data-pagelet*='Search']",
  "[data-pagelet*='search']"
].join(", ");
const LINKEDIN_HIDE_TARGET_SELECTOR = [
  ".feed-shared-update-v2",
  ".occludable-update",
  ".reusable-search__result-container",
  ".jobs-search-results__list-item",
  ".scaffold-finite-scroll__content > div"
].join(", ");
const HIDE_CONTAINER_SELECTOR = [
  "[data-testid='cellInnerDiv']",
  "[data-testid='tweet']",
  "[role='article']",
  "article",
  ".g",
  ".Gx5Zad",
  ".MjjYud",
  "[data-attrid]",
  "[data-hveid]",
  "[data-pagelet]",
  ".userContentWrapper",
  ".feed-shared-update-v2",
  "li"
].join(", ");
const TEXT_SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "select",
  "option",
  `[${TEXT_WRAPPER_ATTR}]`
].join(", ");

let settings = { ...DEFAULT_SETTINGS };
let scanTimer = null;
let observer = null;
let currentPageUrl = location.href;
let pageSeenSignatures = new Set();
let pendingStats = [];
let statsFlushTimer = null;
let pageSummaryState = createEmptyPageSummary();
let assets = {
  placeholderImage: ""
};
let activeSettings = {
  enabled: true,
  mode: "blur",
  matchScope: "inline",
  blockedTerms: [],
  termMatchers: [],
  termSources: {}
};
let pageSummarySyncTimer = null;
let lastPersistedSummarySignature = "";
let focusCountdownTimer = null;

function createEmptyPageSummary() {
  return {
    url: location.href,
    host: location.hostname,
    totalBlocked: 0,
    reasons: {},
    lastUpdated: ""
  };
}

function isFacebookHost() {
  return location.hostname === "facebook.com" || location.hostname.endsWith(".facebook.com");
}

function isLinkedInHost() {
  return location.hostname === "linkedin.com" || location.hostname.endsWith(".linkedin.com");
}

function isFacebookSearchPage() {
  return isFacebookHost() && location.pathname.startsWith("/search/");
}

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeWhitespace(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function deriveSingleWordVariants(term) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm || normalizedTerm.includes(" ")) {
    return [normalizedTerm].filter(Boolean);
  }

  const variants = new Set([normalizedTerm]);

  if (normalizedTerm.length >= 4) {
    variants.add(`${normalizedTerm}s`);
  }

  if (normalizedTerm.endsWith("s") && normalizedTerm.length >= 5) {
    const singular = normalizedTerm.slice(0, -1);
    if (!/(ics|ss|us|is)$/.test(normalizedTerm) && singular.length >= 4) {
      variants.add(singular);
    }
  }

  if (normalizedTerm.endsWith("es") && normalizedTerm.length >= 6) {
    const singularEs = normalizedTerm.slice(0, -2);
    if (!/(ses|xes|zes|ches|shes)$/.test(normalizedTerm) && singularEs.length >= 4) {
      variants.add(singularEs);
    }
  }

  if (normalizedTerm.endsWith("ies") && normalizedTerm.length >= 6) {
    variants.add(`${normalizedTerm.slice(0, -3)}y`);
  }

  if (normalizedTerm.endsWith("y") && normalizedTerm.length >= 4) {
    variants.add(`${normalizedTerm.slice(0, -1)}ies`);
  }

  return Array.from(variants).filter(Boolean);
}

function expandTermsWithVariants(terms) {
  return Array.from(new Set(
    (terms || [])
      .flatMap((term) => deriveSingleWordVariants(term))
      .map(normalize)
      .filter(Boolean)
  ));
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [${FLAG_ATTR}="hide"] {
      display: none !important;
    }

    [${FLAG_ATTR}="blur"] {
      position: relative !important;
      filter: blur(10px) saturate(0.15) !important;
      pointer-events: none !important;
      user-select: none !important;
      border-radius: 0.3em !important;
    }

    [${FLAG_ATTR}="placeholder"] {
      position: relative !important;
      min-width: 4.5em !important;
      min-height: 1.6em !important;
      padding: 0.2em 0.45em !important;
      overflow: hidden !important;
      background:
        linear-gradient(135deg, rgba(18, 18, 18, 0.96), rgba(52, 52, 52, 0.96)) !important;
      background-image: var(--cancel-it-placeholder-image, none),
        linear-gradient(135deg, rgba(18, 18, 18, 0.96), rgba(52, 52, 52, 0.96)) !important;
      background-size: cover !important;
      background-position: center !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 0.45em !important;
      color: transparent !important;
      vertical-align: baseline !important;
    }

    [${TEXT_WRAPPER_ATTR}][${FLAG_ATTR}="placeholder"] {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    [${FLAG_ATTR}="placeholder"]::after {
      content: "Blocked";
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #f5f5f5;
      font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.01em;
    }

    img[${FLAG_ATTR}="placeholder"],
    picture[${FLAG_ATTR}="placeholder"],
    video[${FLAG_ATTR}="placeholder"],
    svg[${FLAG_ATTR}="placeholder"],
    canvas[${FLAG_ATTR}="placeholder"] {
      display: inline-block !important;
      min-width: 120px !important;
      min-height: 120px !important;
      width: auto !important;
      height: auto !important;
      background:
        radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 42%),
        linear-gradient(135deg, rgba(18, 18, 18, 0.96), rgba(52, 52, 52, 0.96)) !important;
      background-image: var(--cancel-it-placeholder-image, none),
        radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 42%),
        linear-gradient(135deg, rgba(18, 18, 18, 0.96), rgba(52, 52, 52, 0.96)) !important;
      background-size: cover !important;
      background-position: center !important;
    }

    [${TEXT_WRAPPER_ATTR}] {
      unicode-bidi: isolate !important;
    }

    [${LABEL_ATTR}]::before {
      content: attr(${LABEL_ATTR});
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 2;
      max-width: min(82%, 320px);
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(12, 12, 12, 0.86);
      color: #fff4eb;
      font: 700 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    html[${PAGE_FLAG_ATTR}="page-blur"] body {
      filter: blur(18px) saturate(0.15) !important;
      pointer-events: none !important;
      user-select: none !important;
    }

    #${FOCUS_OVERLAY_ID} {
      all: initial !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #f4f3ef !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }

    #${FOCUS_OVERLAY_ID} * {
      box-sizing: border-box !important;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-card {
      max-width: 420px;
      width: calc(100% - 48px);
      padding: 40px 36px;
      border-radius: 20px;
      background: #ffffff;
      border: 1px solid #e4e2dc;
      box-shadow: 0 30px 70px rgba(31, 36, 33, 0.16);
      text-align: center;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-logo {
      width: 44px;
      height: 44px;
      margin: 0 auto 16px;
      border-radius: 13px;
      background: #0e7a6b;
      position: relative;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-logo::after {
      content: "";
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: #f7c948;
      top: 5px;
      right: 4px;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-kicker {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0e7a6b;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-title {
      margin: 0 0 10px;
      font-size: 21px;
      font-weight: 700;
      color: #1f2421;
      line-height: 1.3;
      word-break: break-word;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-sub {
      margin: 0 0 4px;
      font-size: 14px;
      color: #4a4f47;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-countdown {
      margin: 0 0 22px;
      font-size: 13px;
      color: #9a9f97;
      font-variant-numeric: tabular-nums;
    }

    #${FOCUS_OVERLAY_ID} .cancel-it-focus-manage {
      display: inline-block;
      font-size: 13px;
      font-weight: 600;
      color: #0e7a6b;
      text-decoration: none;
      border-bottom: 1px solid #cbe2da;
      padding-bottom: 2px;
    }
  `;

  document.documentElement.appendChild(style);
}

function applyAssetStyles() {
  const image = (assets.placeholderImage || "").replace(/["\\\n\r]/g, "");
  if (image) {
    document.documentElement.style.setProperty("--cancel-it-placeholder-image", `url("${image}")`);
  } else {
    document.documentElement.style.removeProperty("--cancel-it-placeholder-image");
  }
}

function pruneExpiredTempTerms(terms) {
  const now = Date.now();
  return (terms || []).filter((entry) => !entry.expiresAt || new Date(entry.expiresAt).getTime() > now);
}

function getPackTerms(packIds) {
  return (packIds || []).flatMap((packId) => {
    const pack = PACKS[packId] || settings.customPacks?.[packId];
    if (!pack) {
      return [];
    }

    return Array.isArray(pack) ? pack : (pack.terms || []);
  });
}

function getPackCustomTerms(customTerms) {
  return Object.values(customTerms || {}).flatMap((terms) => terms || []);
}

function buildTermSources() {
  const sources = {};
  const registerSource = (term, label) => {
    for (const variant of deriveSingleWordVariants(term)) {
      if (variant && !sources[variant]) {
        sources[variant] = label;
      }
    }
  };

  for (const term of settings.blockedTerms || []) {
    registerSource(term, "Manual blocklist");
  }

  for (const packId of settings.enabledPacks || []) {
    const pack = PACKS[packId] || settings.customPacks?.[packId];
    const packTerms = Array.isArray(pack) ? pack : (pack?.terms || []);
    const label = settings.customPacks?.[packId]?.label
      ? `${settings.customPacks[packId].label} pack`
      : (PACK_LABELS[packId] || "Pack");

    for (const term of packTerms) {
      registerSource(term, label);
    }
  }

  for (const [packId, terms] of Object.entries(settings.packCustomTerms || {})) {
    const packLabel = settings.customPacks?.[packId]?.label || PACK_LABELS[packId]?.replace(/ pack$/, "") || packId;
    for (const term of terms || []) {
      registerSource(term, `${packLabel} custom keywords`);
    }
  }

  for (const entry of pruneExpiredTempTerms(settings.tempMutedTerms)) {
    registerSource(entry.term, "Temporary mute");
  }

  return sources;
}

function matchesSitePattern(pattern, hostname) {
  if (!pattern || !hostname) {
    return false;
  }

  const normalizedPattern = pattern.toLowerCase().trim();
  const normalizedHost = hostname.toLowerCase();
  return normalizedHost === normalizedPattern || normalizedHost.endsWith(`.${normalizedPattern}`);
}

function resolveSiteRule(rules, hostname) {
  const matched = (rules || [])
    .filter((rule) => rule.enabled !== false && matchesSitePattern(rule.pattern, hostname))
    .sort((left, right) => right.pattern.length - left.pattern.length);

  return matched[0] || null;
}

// Focus Mode blocks by hostname, independent of keyword filtering and the
// master enabled flag, so a session keeps holding even if someone flips
// filtering off elsewhere (they'd still need the parent PIN to do that when
// one is set — the same speed bump the rest of the product relies on).
function getActiveFocusBlock() {
  const focusMode = settings.focusMode;
  if (!focusMode?.active || !focusMode.sessionEndsAt) {
    return null;
  }

  const endsAt = new Date(focusMode.sessionEndsAt).getTime();
  if (!Number.isFinite(endsAt) || endsAt <= Date.now()) {
    return null;
  }

  const isBlockedSite = (focusMode.blockedSites || []).some((site) => matchesSitePattern(site, location.hostname));
  return isBlockedSite ? { endsAt } : null;
}

function formatFocusCountdown(msRemaining) {
  const totalSeconds = Math.max(0, Math.round(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
}

function updateFocusCountdown(endsAt) {
  const countdownNode = document.getElementById("cancel-it-focus-countdown");
  if (!countdownNode) {
    window.clearInterval(focusCountdownTimer);
    return;
  }

  const remaining = endsAt - Date.now();
  if (remaining <= 0) {
    window.clearInterval(focusCountdownTimer);
    fullRescan();
    return;
  }

  countdownNode.textContent = formatFocusCountdown(remaining);
}

function renderFocusBlock(endsAt) {
  let overlay = document.getElementById(FOCUS_OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = FOCUS_OVERLAY_ID;
    const manageUrl = chrome.runtime.getURL("options.html#focus");
    overlay.innerHTML = `
      <div class="cancel-it-focus-card">
        <div class="cancel-it-focus-logo"></div>
        <p class="cancel-it-focus-kicker">Focus session</p>
        <h1 class="cancel-it-focus-title">${escapeHtml(location.hostname)} is off-limits right now</h1>
        <p class="cancel-it-focus-sub">Back at <strong id="cancel-it-focus-clock"></strong></p>
        <p class="cancel-it-focus-countdown" id="cancel-it-focus-countdown"></p>
        <a class="cancel-it-focus-manage" href="${manageUrl}" target="_blank" rel="noreferrer noopener">Manage focus session</a>
      </div>
    `;
    document.documentElement.appendChild(overlay);
    document.documentElement.style.setProperty("overflow", "hidden", "important");
  }

  const clockNode = document.getElementById("cancel-it-focus-clock");
  if (clockNode) {
    clockNode.textContent = new Date(endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  updateFocusCountdown(endsAt);
  window.clearInterval(focusCountdownTimer);
  focusCountdownTimer = window.setInterval(() => updateFocusCountdown(endsAt), 1000);
}

function removeFocusBlock() {
  window.clearInterval(focusCountdownTimer);
  focusCountdownTimer = null;
  document.documentElement.style.removeProperty("overflow");
  const overlay = document.getElementById(FOCUS_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

function rebuildActiveSettings() {
  const activeTempTerms = pruneExpiredTempTerms(settings.tempMutedTerms);
  const packTerms = getPackTerms(settings.enabledPacks);
  const packCustomTerms = getPackCustomTerms(settings.packCustomTerms);
  const mergedTerms = expandTermsWithVariants([
    ...(settings.blockedTerms || []),
    ...packTerms,
    ...packCustomTerms,
    ...activeTempTerms.map((entry) => entry.term)
  ]);

  const siteRule = resolveSiteRule(settings.siteRules, location.hostname);
  const siteMode = siteRule?.mode || settings.mode;
  const siteScope = siteRule?.matchScope || settings.matchScope || "inline";

  activeSettings = {
    enabled: settings.enabled && siteMode !== "off",
    mode: siteMode,
    matchScope: siteScope,
    blockedTerms: mergedTerms,
    // Each term only matches when it starts at a word boundary, so "crypto"
    // still catches "cryptobro" but no longer fires on mid-word hits.
    termMatchers: mergedTerms.map((term) => ({
      term,
      regex: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}`, "iu")
    })),
    termSources: buildTermSources()
  };
}

function getTerms() {
  return activeSettings.blockedTerms || [];
}

function getTermRegex() {
  const terms = getTerms();
  if (!terms.length) {
    return null;
  }

  return new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map(escapeRegExp).join("|")})`, "giu");
}

function unwrapTextWrappers(root = document.body) {
  if (!root?.querySelectorAll) {
    return;
  }

  const wrappers = root.querySelectorAll(`[${TEXT_WRAPPER_ATTR}]`);
  for (const wrapper of wrappers) {
    const textNode = document.createTextNode(wrapper.textContent || "");
    wrapper.replaceWith(textNode);
  }
}

function clearBlockedState(root = document.body) {
  if (!root?.querySelectorAll) {
    return;
  }

  document.documentElement.removeAttribute(PAGE_FLAG_ATTR);
  unwrapTextWrappers(root);

  const blocked = root.querySelectorAll(`[${FLAG_ATTR}]`);
  for (const node of blocked) {
    node.removeAttribute(FLAG_ATTR);
    node.removeAttribute(REASON_ATTR);
    node.removeAttribute(LABEL_ATTR);
  }
}

function queueStatsEvent(event) {
  pendingStats.push(event);
  window.clearTimeout(statsFlushTimer);
  statsFlushTimer = window.setTimeout(flushStats, 400);
}

function flushStats() {
  if (!pendingStats.length) {
    return;
  }

  const events = pendingStats.splice(0, pendingStats.length);
  chrome.storage.local.get([STATS_STORAGE_KEY, PAGE_SUMMARY_STORAGE_KEY], (result) => {
    const stats = result[STATS_STORAGE_KEY] || {
      totalBlocked: 0,
      byKeyword: {},
      recent: []
    };
    stats.byDay = stats.byDay || {};
    const pageSummaries = result[PAGE_SUMMARY_STORAGE_KEY] || {};

    for (const event of events) {
      stats.totalBlocked += 1;
      stats.byKeyword[event.term] = (stats.byKeyword[event.term] || 0) + 1;
      const dayKey = (event.timestamp || new Date().toISOString()).slice(0, 10);
      stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + 1;
      stats.recent.unshift({
        term: event.term,
        source: event.source,
        type: event.type,
        host: event.host,
        timestamp: event.timestamp
      });
    }

    const dayCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const dayKey of Object.keys(stats.byDay)) {
      if (dayKey < dayCutoff) {
        delete stats.byDay[dayKey];
      }
    }

    stats.recent = stats.recent.slice(0, 100);
    stats.lastUpdated = new Date().toISOString();
    const nextPageSummaries = {
      ...pageSummaries,
      [location.href]: {
        ...pageSummaryState,
        url: location.href,
        host: location.hostname,
        lastUpdated: new Date().toISOString()
      }
    };
    const trimmedPageSummaries = Object.fromEntries(
      Object.entries(nextPageSummaries)
        .sort((left, right) => new Date(right[1].lastUpdated || 0).getTime() - new Date(left[1].lastUpdated || 0).getTime())
        .slice(0, 25)
    );

    chrome.storage.local.set({
      [STATS_STORAGE_KEY]: stats,
      [PAGE_SUMMARY_STORAGE_KEY]: trimmedPageSummaries
    });
  });
}

function getElementPath(target) {
  if (!(target instanceof Element)) {
    return "";
  }

  const segments = [];
  let current = target;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    const parent = current.parentElement;
    const siblings = parent ? Array.from(parent.children).filter((child) => child.tagName === current.tagName) : [];
    const index = siblings.indexOf(current);
    segments.unshift(`${current.tagName}:${index}`);
    current = parent;
  }

  return segments.join(">");
}

function recordBlock(reason, type, target, signatureHint = "") {
  const signature = signatureHint || `${reason}|${type}|${getElementPath(target)}`;
  if (pageSeenSignatures.has(signature)) {
    return;
  }

  pageSeenSignatures.add(signature);
  const source = activeSettings.termSources?.[normalize(reason)] || "Manual blocklist";
  pageSummaryState.url = location.href;
  pageSummaryState.host = location.hostname;
  pageSummaryState.totalBlocked += 1;
  pageSummaryState.reasons[source] = (pageSummaryState.reasons[source] || 0) + 1;
  pageSummaryState.lastUpdated = new Date().toISOString();
  queueStatsEvent({
    term: reason,
    source,
    type,
    host: location.hostname,
    timestamp: new Date().toISOString()
  });
}

function chooseHideTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const siteSpecificContainer = chooseSiteSpecificHideTarget(target);
  if (siteSpecificContainer) {
    return siteSpecificContainer;
  }

  const container = target.closest(HIDE_CONTAINER_SELECTOR);
  if (!container) {
    return target;
  }

  if (container === document.body || container === document.documentElement) {
    return target;
  }

  const rect = container.getBoundingClientRect();
  const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);
  const containerArea = Math.max(rect.width * rect.height, 0);

  // Avoid hiding giant page wrappers when site markup is too coarse.
  if (containerArea > viewportArea * 0.92) {
    return target;
  }

  return container;
}

function getAncestorChain(target) {
  const ancestors = [];
  let current = target instanceof Element ? target : null;

  while (current && current !== document.body && current !== document.documentElement) {
    ancestors.push(current);
    current = current.parentElement;
  }

  return ancestors;
}

function isReasonableCardRect(rect) {
  const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);
  const area = Math.max(rect.width * rect.height, 0);

  if (rect.width < Math.min(260, window.innerWidth * 0.28)) {
    return false;
  }

  if (rect.height < 72) {
    return false;
  }

  if (area > viewportArea * 0.92) {
    return false;
  }

  return true;
}

function scoreFacebookHideCandidate(element) {
  if (!(element instanceof Element)) {
    return -1;
  }

  const rect = element.getBoundingClientRect();
  if (!isReasonableCardRect(rect)) {
    return -1;
  }

  let score = 0;
  const text = normalizeWhitespace(element.innerText || "");
  const directText = normalizeWhitespace(Array.from(element.childNodes || [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join(" "));

  if (element.matches("[role='article'], [data-pagelet*='FeedUnit'], [data-pagelet*='Search'], [data-pagelet*='search']")) {
    score += 8;
  }

  if (element.querySelector("[aria-label*='Actions for this post']")) {
    score += 10;
  }

  if (element.querySelector("button[aria-label*='Comment'], button[aria-label*='Share'], button[aria-label*='React'], button[aria-label*='Like']")) {
    score += 6;
  }

  if (element.querySelector("button, [role='button']")) {
    score += 2;
  }

  if (element.querySelector("img, video")) {
    score += 2;
  }

  if (element.querySelector("a[href*='/groups/'], a[href*='/posts/'], a[href*='/photo/'], a[href*='/watch/']")) {
    score += 3;
  }

  if (text.length >= 40) {
    score += 2;
  }

  if (text.length >= 120) {
    score += 2;
  }

  if (directText.length > 0) {
    score += 1;
  }

  if (rect.width >= window.innerWidth * 0.35) {
    score += 2;
  }

  if (rect.height >= 140) {
    score += 2;
  }

  return score;
}

function scoreFacebookSearchResultCandidate(element) {
  if (!(element instanceof Element)) {
    return -1;
  }

  const rect = element.getBoundingClientRect();
  if (!isReasonableCardRect(rect)) {
    return -1;
  }

  const minLeft = window.innerWidth * 0.26;
  if (rect.left < minLeft) {
    return -1;
  }

  if (rect.width < 320 || rect.width > window.innerWidth * 0.88) {
    return -1;
  }

  const text = normalizeWhitespace(element.innerText || "");
  if (text.length < 20) {
    return -1;
  }

  let score = 0;

  if (element.querySelector("[aria-label*='Actions for this post']")) {
    score += 12;
  }

  if (element.querySelector("button[aria-label*='Comment'], button[aria-label*='Share'], button[aria-label*='Follow'], button[aria-label*='Join']")) {
    score += 8;
  }

  if (element.querySelector("img, video")) {
    score += 4;
  }

  if (element.querySelector("a[href*='/groups/'], a[href*='/posts/'], a[href*='/videos/'], a[href*='/watch/'], a[href*='/photo/']")) {
    score += 5;
  }

  if (element.querySelector("h1, h2, h3, h4, [role='heading']")) {
    score += 4;
  }

  if (text.length >= 80) {
    score += 3;
  }

  if (text.length >= 180) {
    score += 3;
  }

  if (rect.height >= 160) {
    score += 3;
  }

  if (rect.height >= 260) {
    score += 3;
  }

  return score;
}

function chooseFacebookSearchHideTarget(target) {
  let bestCandidate = null;
  let bestScore = -1;

  for (const ancestor of getAncestorChain(target)) {
    const score = scoreFacebookSearchResultCandidate(ancestor);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = ancestor;
    }
  }

  return bestScore >= 12 ? bestCandidate : null;
}

function chooseFacebookHideTarget(target) {
  if (isFacebookSearchPage()) {
    const searchTarget = chooseFacebookSearchHideTarget(target);
    if (searchTarget) {
      return searchTarget;
    }
  }

  const selectorMatch = target.closest(FACEBOOK_HIDE_TARGET_SELECTOR);
  if (selectorMatch && selectorMatch !== document.body && selectorMatch !== document.documentElement) {
    const rect = selectorMatch.getBoundingClientRect();
    if (isReasonableCardRect(rect)) {
      return selectorMatch;
    }
  }

  let bestCandidate = null;
  let bestScore = -1;
  for (const ancestor of getAncestorChain(target)) {
    const score = scoreFacebookHideCandidate(ancestor);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = ancestor;
    }
  }

  return bestScore >= 8 ? bestCandidate : null;
}

function chooseSiteSpecificHideTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  if (isFacebookHost()) {
    return chooseFacebookHideTarget(target);
  }

  const selector = isLinkedInHost() ? LINKEDIN_HIDE_TARGET_SELECTOR : "";

  if (!selector) {
    return null;
  }

  const container = target.closest(selector);
  if (!container || container === document.body || container === document.documentElement) {
    return null;
  }

  const rect = container.getBoundingClientRect();
  const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);
  const containerArea = Math.max(rect.width * rect.height, 0);

  if (containerArea > viewportArea * 0.92) {
    return null;
  }

  return container;
}

function chooseInlineTextTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const leafText = normalizeWhitespace(target.textContent || "");
  if (!leafText) {
    return null;
  }

  const directTextLength = Array.from(target.childNodes || [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join("")
    .trim()
    .length;

  const safeTags = new Set(["SPAN", "A", "BUTTON", "P", "LI", "DIV", "H1", "H2", "H3", "H4", "STRONG", "EM"]);
  if (!safeTags.has(target.tagName)) {
    return null;
  }

  if (target.closest(HIDE_CONTAINER_SELECTOR)) {
    return target;
  }

  if (target.childElementCount <= 2 && leafText.length <= 180 && directTextLength > 0) {
    return target;
  }

  return null;
}

function applyBlock(target, reason, type, signatureHint = "") {
  if (!(target instanceof Element)) {
    return;
  }

  target.setAttribute(FLAG_ATTR, activeSettings.mode);
  target.setAttribute(REASON_ATTR, `matched: ${escapeHtml(reason)}`);
  const label = getReasonLabel(reason, target, type);
  if (label) {
    target.setAttribute(LABEL_ATTR, label);
  }
  recordBlock(reason, type, target, signatureHint);
}

function getReasonLabel(reason, target, type) {
  if (!shouldShowReasonBadge(target, type)) {
    return "";
  }

  const source = activeSettings.termSources?.[normalize(reason)] || "Manual blocklist";
  return `Hidden by ${source}`;
}

function shouldShowReasonBadge(target, type) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (activeSettings.mode !== "blur" && activeSettings.mode !== "placeholder") {
    return false;
  }

  if (target.hasAttribute(TEXT_WRAPPER_ATTR)) {
    return false;
  }

  if (type === "structured-container" || type === "media-container" || type === "image") {
    return true;
  }

  const rect = target.getBoundingClientRect();
  return rect.width >= 160 && rect.height >= 48;
}

function collectElementText(node) {
  if (!(node instanceof Element)) {
    return "";
  }

  return [
    node.getAttribute("aria-label"),
    node.getAttribute("title"),
    node.getAttribute("alt"),
    node.getAttribute("content"),
    node.getAttribute("src"),
    node.getAttribute("href"),
    node.currentSrc,
    node.src
  ]
    .filter(Boolean)
    .join(" ");
}

function getContainerScanSelector() {
  if (isFacebookHost()) {
    return FACEBOOK_CONTAINER_SELECTOR;
  }

  if (isLinkedInHost()) {
    return LINKEDIN_CONTAINER_SELECTOR;
  }

  return "";
}

function scanStructuredContainers(root) {
  const selector = getContainerScanSelector();
  if (!selector) {
    return;
  }

  const containers = root.matches?.(selector)
    ? [root, ...root.querySelectorAll(selector)]
    : Array.from(root.querySelectorAll?.(selector) || []);

  for (const element of containers) {
    if (!(element instanceof Element)) {
      continue;
    }

    if (element.closest(`[${FLAG_ATTR}]`)) {
      continue;
    }

    const reason = getMatchReason([
      normalizeWhitespace(element.innerText || ""),
      collectElementText(element)
    ].join(" "));

    if (!reason) {
      continue;
    }

    const target = activeSettings.matchScope === "block"
      ? chooseHideTarget(element) || element
      : chooseInlineTextTarget(element) || element;

    applyBlock(
      target,
      reason,
      "structured-container",
      `${reason}|structured-container|${getElementPath(target)}|${normalizeWhitespace(element.innerText || "").slice(0, 120)}`
    );
  }
}

function scanFacebookSearchResults(root) {
  if (!isFacebookSearchPage()) {
    return;
  }

  const main = document.querySelector("[role='main']") || document.body;
  const scope = root === document.body ? main : root;
  const candidates = scope.matches?.("div, article, section")
    ? [scope, ...scope.querySelectorAll("div, article, section")]
    : Array.from(scope.querySelectorAll?.("div, article, section") || []);

  for (const element of candidates) {
    if (!(element instanceof Element)) {
      continue;
    }

    if (element.closest(`[${FLAG_ATTR}]`)) {
      continue;
    }

    if (scoreFacebookSearchResultCandidate(element) < 12) {
      continue;
    }

    const combinedText = [
      normalizeWhitespace(element.innerText || ""),
      collectElementText(element)
    ].join(" ");
    const reason = getMatchReason(combinedText);
    if (!reason) {
      continue;
    }

    const target = activeSettings.matchScope === "block"
      ? chooseFacebookSearchHideTarget(element) || element
      : chooseInlineTextTarget(element) || element;

    applyBlock(
      target,
      reason,
      "facebook-search-card",
      `${reason}|facebook-search-card|${getElementPath(target)}|${normalizeWhitespace(element.innerText || "").slice(0, 160)}`
    );
  }
}

function collectPageText() {
  const parts = [
    document.body?.innerText || "",
    ...Array.from(document.images || []).flatMap((image) => [
      image.alt || "",
      image.title || "",
      image.currentSrc || "",
      image.src || ""
    ])
  ];

  return parts.join(" ");
}

function getMatchReason(text) {
  const normalizedText = normalize(text);
  if (!normalizedText) {
    return null;
  }

  for (const matcher of activeSettings.termMatchers || []) {
    if (matcher.regex.test(normalizedText)) {
      return matcher.term;
    }
  }

  return null;
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  if (parent.closest(TEXT_SKIP_SELECTOR)) {
    return true;
  }

  if (parent.closest(`[${FLAG_ATTR}]`)) {
    return true;
  }

  return !node.textContent || !node.textContent.trim();
}

function wrapMatchesInTextNode(node, regex) {
  if (!(node instanceof Text) || shouldSkipTextNode(node)) {
    return false;
  }

  const text = node.textContent;
  regex.lastIndex = 0;

  if (!regex.test(text)) {
    return false;
  }

  if (activeSettings.mode === "hide" && activeSettings.matchScope === "inline") {
    const inlineTarget = chooseInlineTextTarget(node.parentElement);
    const reason = getMatchReason(text);
    if (inlineTarget && reason) {
      applyBlock(
        inlineTarget,
        reason,
        "text",
        `${reason}|inline-hide|${getElementPath(inlineTarget)}|${text.slice(0, 120)}`
      );
      return true;
    }
  }

  regex.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  const parentPath = getElementPath(node.parentElement);
  const matchedRanges = [];

  text.replace(regex, (match, _group, offset) => {
    matchedRanges.push({
      match,
      offset
    });

    if (offset > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
    }

    const wrapper = document.createElement("span");
    wrapper.setAttribute(TEXT_WRAPPER_ATTR, "true");
    wrapper.textContent = match;
    applyBlock(
      wrapper,
      normalize(match),
      "text",
      `${normalize(match)}|text|${parentPath}|${offset}`
    );
    fragment.appendChild(wrapper);
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  if (activeSettings.matchScope === "block" && matchedRanges.length) {
    const firstMatch = matchedRanges[0];
    const hideTarget = chooseHideTarget(node.parentElement);
    if (hideTarget) {
      applyBlock(
        hideTarget,
        normalize(firstMatch.match),
        "text",
        `${normalize(firstMatch.match)}|hide-block|${getElementPath(hideTarget)}|${firstMatch.offset}`
      );
      return true;
    }
  }

  node.replaceWith(fragment);
  return true;
}

function scanText(root) {
  const regex = getTermRegex();
  if (!regex) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const textNode of textNodes) {
    wrapMatchesInTextNode(textNode, regex);
  }
}

function scanImages(root) {
  const elements = root.matches?.(IMG_SELECTOR)
    ? [root, ...root.querySelectorAll(IMG_SELECTOR)]
    : Array.from(root.querySelectorAll?.(IMG_SELECTOR) || []);

  for (const element of elements) {
    if (!(element instanceof Element)) {
      continue;
    }

    const reason = getMatchReason(collectElementText(element));
    if (!reason) {
      continue;
    }

    const target = activeSettings.matchScope === "block" ? chooseHideTarget(element) : element;
    applyBlock(
      target,
      reason,
      "image",
      `${reason}|image|${getElementPath(target)}|${collectElementText(element).slice(0, 120)}`
    );
  }
}

function scanMediaContainers(root) {
  const elements = root.matches?.(MEDIA_CONTAINER_SELECTOR)
    ? [root, ...root.querySelectorAll(MEDIA_CONTAINER_SELECTOR)]
    : Array.from(root.querySelectorAll?.(MEDIA_CONTAINER_SELECTOR) || []);

  for (const element of elements) {
    if (!(element instanceof Element) || !element.querySelector(IMG_SELECTOR)) {
      continue;
    }

    if (element.closest(`[${FLAG_ATTR}]`)) {
      continue;
    }

    const reason = getMatchReason([
      collectElementText(element),
      normalizeWhitespace(element.innerText || "")
    ].join(" "));
    if (!reason) {
      continue;
    }

    const target = activeSettings.matchScope === "block" ? chooseHideTarget(element) : element;
    applyBlock(
      target,
      reason,
      "media-container",
      `${reason}|media-container|${getElementPath(target)}|${collectElementText(element).slice(0, 120)}`
    );
  }
}

function refreshPageSessionState() {
  if (location.href !== currentPageUrl) {
    currentPageUrl = location.href;
    pageSeenSignatures = new Set();
    pageSummaryState = createEmptyPageSummary();
  }
}

function schedulePageSummarySync() {
  window.clearTimeout(pageSummarySyncTimer);
  pageSummarySyncTimer = window.setTimeout(persistPageSummary, 900);
}

// Keeps the popup honest: writes this page's summary even when nothing was
// blocked, so a previous visit's counts don't linger for the same URL.
function persistPageSummary() {
  const signature = `${location.href}|${pageSummaryState.totalBlocked}`;
  if (signature === lastPersistedSummarySignature) {
    return;
  }

  lastPersistedSummarySignature = signature;
  chrome.storage.local.get([PAGE_SUMMARY_STORAGE_KEY], (result) => {
    const pageSummaries = result[PAGE_SUMMARY_STORAGE_KEY] || {};

    // Only record URLs that have blocks, or overwrite a stale entry from a
    // previous visit — never build a log of clean pages.
    if (!pageSummaryState.totalBlocked && !pageSummaries[location.href]) {
      return;
    }

    const nextPageSummaries = {
      ...pageSummaries,
      [location.href]: {
        ...pageSummaryState,
        url: location.href,
        host: location.hostname,
        lastUpdated: new Date().toISOString()
      }
    };
    const trimmedPageSummaries = Object.fromEntries(
      Object.entries(nextPageSummaries)
        .sort((left, right) => new Date(right[1].lastUpdated || 0).getTime() - new Date(left[1].lastUpdated || 0).getTime())
        .slice(0, 25)
    );

    chrome.storage.local.set({ [PAGE_SUMMARY_STORAGE_KEY]: trimmedPageSummaries });
  });
}

function fullRescan() {
  refreshPageSessionState();
  rebuildActiveSettings();
  ensureStyles();

  // Pause the observer while we mutate the DOM ourselves; otherwise the
  // clear-and-reapply cycle generates mutations that schedule the next rescan
  // forever, burning CPU on every page with at least one match.
  observer?.disconnect();
  try {
    clearBlockedState();

    const focusBlock = getActiveFocusBlock();
    if (focusBlock) {
      renderFocusBlock(focusBlock.endsAt);
      return;
    }
    removeFocusBlock();

    if (!activeSettings.enabled || !document.body) {
      return;
    }

    if (activeSettings.mode === "page-blur") {
      const reason = getMatchReason(collectPageText());
      if (reason) {
        document.documentElement.setAttribute(PAGE_FLAG_ATTR, "page-blur");
        document.documentElement.setAttribute(REASON_ATTR, `matched: ${escapeHtml(reason)}`);
        recordBlock(reason, "page", document.body, `${reason}|page|${location.href}`);
      }
      return;
    }

    scanFacebookSearchResults(document.body);
    scanStructuredContainers(document.body);
    scanText(document.body);
    scanImages(document.body);
    scanMediaContainers(document.body);
  } finally {
    observeBody();
    schedulePageSummarySync();
  }
}

function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    fullRescan();
  }, 120);
}

function observeBody() {
  if (!observer || !document.body) {
    return;
  }

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["alt", "title", "aria-label", "src", "href", "content"]
  });
}

function startObserver() {
  if (observer || !document.body) {
    return;
  }

  observer = new MutationObserver(() => {
    scheduleScan();
  });

  observeBody();
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (syncResult) => {
      settings = { ...DEFAULT_SETTINGS, ...(syncResult[STORAGE_KEY] || {}) };
      settings.tempMutedTerms = pruneExpiredTempTerms(settings.tempMutedTerms);
      chrome.storage.local.get([ASSETS_STORAGE_KEY], (localResult) => {
        assets = { ...assets, ...(localResult[ASSETS_STORAGE_KEY] || {}) };
        resolve();
      });
    });
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    settings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue || {}) };
    settings.tempMutedTerms = pruneExpiredTempTerms(settings.tempMutedTerms);
    fullRescan();
  }

  if (areaName === "local" && changes[ASSETS_STORAGE_KEY]) {
    assets = { ...assets, ...(changes[ASSETS_STORAGE_KEY].newValue || {}) };
    applyAssetStyles();
    fullRescan();
  }
});

async function init() {
  await loadSettings();
  ensureStyles();
  applyAssetStyles();
  fullRescan();
  startObserver();

  window.addEventListener("pagehide", flushStats);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushStats();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
