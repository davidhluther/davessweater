"use client";
// Progressive enhancement for the expandable show cards on /fireworks: when a
// quickjump or shared link targets a <details id="..."> card, open it so the
// reader doesn't land on a collapsed box. The content itself is native
// <details> markup — fully present in the prerendered HTML for crawlers and
// for anyone with JavaScript off; this only flips the `open` attribute.
import { useEffect } from "react";

export default function OpenTargetDetails() {
  useEffect(() => {
    const openTarget = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
    };
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);
  return null;
}
