/*!
 * Dave's Sweater embeddable forecast widget.
 * Usage (paste on any page):
 *   <script src="https://davessweater.com/widget.js"
 *           data-town="boone" data-days="3" data-detail="summary" async></script>
 *
 * Replaces its own <script> tag with an <iframe> pointing at /widget, and sizes
 * that iframe to its content via postMessage (falling back to a fixed height if
 * the message never arrives). Dependency-free; leaks no globals (one IIFE).
 */
(function () {
  "use strict";

  // Resolve our own <script> even when async defers currentScript.
  var self =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if ((all[i].src || "").indexOf("/widget.js") !== -1) return all[i];
      }
      return null;
    })();
  if (!self || !self.parentNode) return;

  var base;
  try {
    base = new URL(self.src).origin;
  } catch {
    base = "https://davessweater.com";
  }

  var town = self.getAttribute("data-town") || "boone";
  var days = self.getAttribute("data-days") || "3";
  var detail = self.getAttribute("data-detail") || "summary";
  // Only used if the postMessage sizing never lands (JS-blocked, sandboxed
  // iframe). Raised 320 → 400 with the 2026-07-28 rebuild: the card now carries
  // today's block, the days ahead, an almanac line, and two links.
  var fallbackHeight = parseInt(self.getAttribute("data-height") || "400", 10);

  // Unique id so a page embedding several widgets sizes each independently.
  var id = "dsw-" + Math.random().toString(36).slice(2, 10);

  var q =
    "town=" + encodeURIComponent(town) +
    "&days=" + encodeURIComponent(days) +
    "&detail=" + encodeURIComponent(detail) +
    "&id=" + encodeURIComponent(id);

  var iframe = document.createElement("iframe");
  iframe.src = base + "/widget?" + q;
  iframe.title = "Dave's Sweater forecast";
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.background = "transparent";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.height = fallbackHeight + "px";

  window.addEventListener("message", function (e) {
    if (e.origin !== base) return;
    var d = e.data;
    if (d && d.type === "ds-widget-height" && d.id === id && typeof d.height === "number") {
      iframe.style.height = Math.ceil(d.height) + "px";
    }
  });

  // Replace the script tag with the iframe.
  self.parentNode.insertBefore(iframe, self);
  self.parentNode.removeChild(self);
})();
