// Companion to image-hold.css (registered together, document_start, only while explicit-image
// detection is on). Its single job: stamp data-cancel-it-loaded on an <img> once it has finished
// loading, so the stylesheet's 4s fail-open clock starts at load rather than at insertion.
// Deliberately tiny and independent of content.js, the service worker and the model: this file
// is what guarantees a picture is never left invisible if everything else is dead.
(() => {
  const LOADED = "data-cancel-it-loaded";
  const stamp = (img) => img.setAttribute(LOADED, "");

  // Pictures that finish loading while attached to the page.
  const onFinished = (event) => {
    if (event.target instanceof HTMLImageElement) {
      stamp(event.target);
    }
  };
  document.addEventListener("load", onFinished, true);
  document.addEventListener("error", onFinished, true);

  // Pictures that were already finished when they were added (preloaded with `new Image()` and
  // appended later, cached ones, and <img> with no src at all): no load event will ever reach us
  // for those, and without a stamp the stylesheet would keep them invisible forever.
  const stampFinished = (node) => {
    if (node.nodeType !== 1) {
      return;
    }

    if (node instanceof HTMLImageElement) {
      if (node.complete) {
        stamp(node);
      }
    } else if (node.firstElementChild) {
      for (const img of node.getElementsByTagName("img")) {
        if (img.complete) {
          stamp(img);
        }
      }
    }
  };

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach(stampFinished);
        continue;
      }

      // A new src/srcset means a new picture: hold again until that one has loaded.
      let img = record.target;
      if (img instanceof HTMLSourceElement) {
        img = img.closest("picture")?.querySelector("img");
      }
      if (img instanceof HTMLImageElement) {
        img.removeAttribute(LOADED);
      }
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset"]
  });
})();
