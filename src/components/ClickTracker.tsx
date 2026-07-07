"use client";

import { useEffect } from "react";
import { buildClickEventParams } from "@/lib/clickTracking";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Sitewide GA4 click tracking via one delegated listener, mounted once in the
// root layout, rather than an onClick handler on every button/link/dropdown.
// Fires a custom `element_click` event for any click landing on a link,
// button, or <summary> (the on-page TOC and FAQ toggles use <details>).
export default function ClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "a[href], button, summary, [role='button']"
      ) as HTMLElement | null;
      if (!el) return;
      const params = buildClickEventParams(
        {
          tagName: el.tagName.toLowerCase(),
          text: el.textContent,
          href: el.getAttribute("href"),
          ariaLabel: el.getAttribute("aria-label"),
          trackLabel: el.getAttribute("data-track-label"),
        },
        window.location.pathname
      );
      if (params) window.gtag?.("event", "element_click", params);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
