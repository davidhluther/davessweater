import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import TrackingOptOut from "@/components/TrackingOptOut";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  metadataBase: new URL("https://davessweater.com"),
  title: {
    default: "Dave's Sweater — Boone's most mostly reliable weather tracker and resource",
    template: "%s — Dave's Sweater",
  },
  description: "The free forecasts keep beating the paid one. We score every Boone forecast against what actually happened, and keep the receipts.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  other: {
    "google-site-verification": "Ajmlc52hA5hJQr-7WY7T9YU4Vlej8vkx1_GHmYHCAJo",
  },
  openGraph: {
    title: "Dave's Sweater — Boone's #1 weather (service) tracker",
    description: "Every Boone forecast, graded daily against what actually happened. Boone's most mostly reliable weather resource.",
    url: "https://davessweater.com", type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dave's Sweater — Boone's most mostly reliable weather tracker",
    description: "The free forecasts keep beating the paid one. We score every Boone forecast against what actually happened, and keep the receipts.",
  },
};

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Dave's Sweater",
    "url": "https://davessweater.com",
    "description": "Boone, NC weather forecast accuracy tracker. We score every local forecast against what actually happened.",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Dave's Sweater",
    "url": "https://davessweater.com",
    "logo": "https://davessweater.com/assets/logo-white.png",
    "description": "Boone, NC satirical weather tracker scoring local forecast accuracy over time.",
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("antialiased", inter.variable, spaceGrotesk.variable)}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-teal-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <JsonLd data={siteJsonLd} />
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
        <TrackingOptOut />
        <AnalyticsScripts clarityId={process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID} />
      </body>
    </html>
  );
}
