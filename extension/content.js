const STORAGE_KEY = "cancelItSettings";
const STATS_STORAGE_KEY = "cancelItStats";
const ASSETS_STORAGE_KEY = "cancelItAssets";
const PACKS = {
  celebrity_gossip: ["celebrity gossip", "tmz", "paparazzi", "red carpet", "tabloid", "jennifer lopez"],
  politics: ["election", "campaign", "senate", "congress", "white house", "politics"],
  crypto_hype: ["bitcoin", "ethereum", "solana", "memecoin", "crypto", "nft"],
  sports_spoilers: ["final score", "match winner", "spoiler", "knockout", "highlights", "game recap"],
  adult_content: ["porn", "pornography", "nsfw", "explicit", "adult video", "onlyfans"],
  family_safe: ["porn", "nsfw", "explicit", "gore", "violent", "graphic violence", "adult content"],
  ragebait: ["you won't believe", "meltdown", "ratioed", "destroyed", "exposed", "viral outrage"]
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
  siteRules: []
};

const STYLE_ID = "cancel-it-styles";
const FLAG_ATTR = "data-cancel-it-blocked";
const REASON_ATTR = "data-cancel-it-reason";
const TEXT_WRAPPER_ATTR = "data-cancel-it-text-wrapper";
const PAGE_FLAG_ATTR = "data-cancel-it-page-blocked";
const IMG_SELECTOR = "img, picture, video, svg, canvas";
const MEDIA_CONTAINER_SELECTOR = "a, button, [role='button'], [role='link']";
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
let assets = {
  placeholderImage: ""
};
let activeSettings = {
  enabled: true,
  mode: "blur",
  matchScope: "inline",
  blockedTerms: []
};

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

    html[${PAGE_FLAG_ATTR}="page-blur"] body {
      filter: blur(18px) saturate(0.15) !important;
      pointer-events: none !important;
      user-select: none !important;
    }
  `;

  document.documentElement.appendChild(style);
}

function applyAssetStyles() {
  const image = assets.placeholderImage || "";
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

function rebuildActiveSettings() {
  const activeTempTerms = pruneExpiredTempTerms(settings.tempMutedTerms);
  const packTerms = getPackTerms(settings.enabledPacks);
  const packCustomTerms = getPackCustomTerms(settings.packCustomTerms);
  const mergedTerms = Array.from(new Set([
    ...(settings.blockedTerms || []),
    ...packTerms,
    ...packCustomTerms,
    ...activeTempTerms.map((entry) => entry.term)
  ].map(normalize).filter(Boolean)));

  const siteRule = resolveSiteRule(settings.siteRules, location.hostname);
  const siteMode = siteRule?.mode || settings.mode;
  const siteScope = siteRule?.matchScope || settings.matchScope || "inline";

  activeSettings = {
    enabled: settings.enabled && siteMode !== "off",
    mode: siteMode,
    matchScope: siteScope,
    blockedTerms: mergedTerms
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

  return new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
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
  chrome.storage.local.get([STATS_STORAGE_KEY], (result) => {
    const stats = result[STATS_STORAGE_KEY] || {
      totalBlocked: 0,
      byKeyword: {},
      recent: []
    };

    for (const event of events) {
      stats.totalBlocked += 1;
      stats.byKeyword[event.term] = (stats.byKeyword[event.term] || 0) + 1;
      stats.recent.unshift({
        term: event.term,
        type: event.type,
        host: event.host,
        timestamp: event.timestamp
      });
    }

    stats.recent = stats.recent.slice(0, 100);
    stats.lastUpdated = new Date().toISOString();
    chrome.storage.local.set({ [STATS_STORAGE_KEY]: stats });
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
  queueStatsEvent({
    term: reason,
    type,
    host: location.hostname,
    timestamp: new Date().toISOString()
  });
}

function chooseHideTarget(target) {
  if (!(target instanceof Element)) {
    return null;
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
  recordBlock(reason, type, target, signatureHint);
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

  for (const term of getTerms()) {
    if (normalizedText.includes(term)) {
      return term;
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
  }
}

function fullRescan() {
  refreshPageSessionState();
  rebuildActiveSettings();
  ensureStyles();
  clearBlockedState();
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

  scanText(document.body);
  scanImages(document.body);
  scanMediaContainers(document.body);
}

function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    fullRescan();
  }, 120);
}

function startObserver() {
  if (observer || !document.body) {
    return;
  }

  observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["alt", "title", "aria-label", "src", "href", "content"]
  });
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
