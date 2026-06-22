import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import UpdateBar from "@/components/UpdateBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  metadataBase: new URL("https://davessweater.com"),
  title: {
    default: "Dave's Sweater — Boone's most mostly reliable weather tracker and resource",
    template: "%s — Dave's Sweater",
  },
  description: "Is it sweater weather in Boone, NC? Did Ray get yesterday right? Find out.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  other: {
    "google-site-verification": [
      "WvhDdIhrlNBhsVYElbFc39q-Ib8J2UZZJKoy8pzn-KQ",
      "Pxd8jrNaWOdwazTvIA9xHgCib5f8yC3n6IfAZQ1s8M0",
    ],
  },
  openGraph: {
    title: "Dave's Sweater",
    description: "Boone's most mostly reliable weather tracker and resource.",
    url: "https://davessweater.com", type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("antialiased", inter.variable, spaceGrotesk.variable)}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <UpdateBar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
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
