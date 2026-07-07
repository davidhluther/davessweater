"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import ClickTracker from "@/components/ClickTracker";

// GA4 + Clarity + the click tracker, gated behind the ds_track=off cookie
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
      <ClickTracker />
      {clarityId && (
        <Script id="clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=next";
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityId}");
        `}</Script>
      )}
    </>
  );
}
