import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  metadataBase: new URL("https://davessweater.com"),
  title: {
    default: "Dave's Sweater — Boone's most mostly reliable weather tracker and resource",
    template: "%s — Dave's Sweater",
  },
  description: "The free forecast keeps beating the paid one. We score every Boone forecast against what actually happened — and keep the receipts.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  other: {
    "google-site-verification": "Ajmlc52hA5hJQr-7WY7T9YU4Vlej8vkx1_GHmYHCAJo",
  },
  openGraph: {
    title: "Dave's Sweater — Boone's #1 weather (service) tracker",
    description: "Free forecasts beat Ray's, tracked daily. Boone's most mostly reliable weather resource.",
    url: "https://davessweater.com", type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dave's Sweater — Boone's most mostly reliable weather tracker",
    description: "The free forecast keeps beating the paid one. We score every Boone forecast against what actually happened — and keep the receipts.",
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
        <JsonLd data={siteJsonLd} />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-7XL0TZ4GSS" strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-7XL0TZ4GSS');
        `}</Script>
      </body>
    </html>
  );
}
