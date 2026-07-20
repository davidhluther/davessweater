"use client";

import { usePathname } from "next/navigation";

// Hides site chrome (header/footer) on the content editor, which brings its own
// full-screen UI.
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/keystatic")) return null;
  return <>{children}</>;
}
