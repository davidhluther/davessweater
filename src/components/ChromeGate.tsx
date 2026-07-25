"use client";

import { usePathname } from "next/navigation";

// Hides site chrome (header/footer) on the content editor, which brings its own
// full-screen UI, and on the embeddable widget, which is a bare card meant to
// live inside a third-party page's iframe.
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/keystatic")) return null;
  if (pathname?.startsWith("/widget")) return null;
  return <>{children}</>;
}
