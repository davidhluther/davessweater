"use client";
import Script from "next/script";
import Clarity from "@microsoft/clarity";
import { useEffect, useState } from "react";
import ClickTracker from "@/components/ClickTracker";

// GA4 + Clarity + Meta Pixel + the click tracker, gated behind the ds_track=off cookie
// (see TrackingOptOut.tsx) so the owner's own browsing doesn't get counted.
// Starts as "undecided" (renders nothing) rather than assuming enabled, so
// the scripts never mount even for a split second before the cookie check
// resolves — a server/first-client-render mismatch here would otherwise risk
// a brief real load for an opted-out visitor. The env var is still read
// server-side in RootLayout and passed in, since that's a static build-time
// value, not a per-request dynamic API.
export default function AnalyticsScripts({ clarityId }: { clarityId?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setEnabled(!document.cookie.split("; ").includes("ds_track=off"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // The npm package initializes Clarity directly (Clarity.init) instead of
  // the classic inline bootstrap, which defines window.clarity as a stub
  // function and hopes nothing clobbers it before the real script calls it —
  // that pattern was throwing "a[c] is not a function" in testing, 100%
  // reproducibly, independent of network conditions. The module-based init
  // has no such global-poisoning window.
  useEffect(() => {
    if (enabled && clarityId) Clarity.init(clarityId);
  }, [enabled, clarityId]);

  if (!enabled) return null;
  return (
    <>
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-7XL0TZ4GSS" strategy="afterInteractive" />
      <Script id="ga" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-7XL0TZ4GSS');
      `}</Script>
      {/* Meta Pixel — Meta's standard bootstrap verbatim. No <noscript> fallback:
          this component only mounts when JS runs, so one would be dead code. */}
      <Script id="meta-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '4659969744289221');
        fbq('track', 'PageView');
      `}</Script>
      {/* Ahrefs Web Analytics — cookieless. data-key is a public site key (it
          ships in the page HTML), so it lives in the source, not a secret.
          Gated with the rest behind ds_track=off so the owner's own visits
          don't inflate the numbers. */}
      <Script src="https://analytics.ahrefs.com/analytics.js"
        data-key="edi/nQMB6ojgqiFOKFqb8g" strategy="afterInteractive" />
      <ClickTracker />
    </>
  );
}
