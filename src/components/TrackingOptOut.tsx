"use client";
import { useEffect } from "react";

const COOKIE = "ds_track";
const MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

// Visit /?ds_track=off once, from any page, to stop counting that browser in
// GA4/Clarity from then on (AnalyticsScripts.tsx reads this cookie and skips
// loading either script entirely). /?ds_track=on turns it back on. A cookie
// rather than an IP-based GA4 exclusion because a home/mobile IP isn't
// stable; checked client-side rather than via next/headers cookies() in the
// server layout so the rest of the site keeps its static prerendering.
export default function TrackingOptOut() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const val = params.get("ds_track");
    if (val !== "off" && val !== "on") return;
    document.cookie =
      val === "off"
        ? `${COOKIE}=off; path=/; max-age=${MAX_AGE}; samesite=lax; secure`
        : `${COOKIE}=; path=/; max-age=0`;
    params.delete("ds_track");
    const rest = params.toString();
    window.location.replace(window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
  }, []);
  return null;
}
