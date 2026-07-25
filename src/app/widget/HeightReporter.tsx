"use client";

import { useEffect } from "react";

// Reports the rendered card's height to the embedding page so widget.js can
// size its iframe to fit (no inner scrollbar). Measures the widget root element
// (not document.body, which the root layout's min-h-screen would inflate to a
// full viewport). The `id` round-trips from widget.js so a page embedding two
// widgets sizes each one independently.
export default function HeightReporter({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById("ds-widget-root");
    if (!el) return;

    const post = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      window.parent?.postMessage({ type: "ds-widget-height", id, height }, "*");
    };
    post();

    const ro = new ResizeObserver(post);
    ro.observe(el);
    window.addEventListener("load", post);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
    };
  }, [id]);

  return null;
}
