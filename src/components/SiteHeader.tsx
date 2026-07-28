"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TownNavItem } from "@/lib/towns";

// Top-level stays lean; everything editorial lives under the Resources
// dropdown (the label itself links to the /resources hub).
const primary = [
  { href: "/", label: "Today" },
  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },
  { href: "/roads", label: "Roads" },
];
const resources = [
  { href: "/resources/articles", label: "Articles" },
  { href: "/resources/news", label: "News & Updates" },
  { href: "/resources/videos", label: "Videos" },
  { href: "/resources/reports", label: "Reports" },
];
const shop = { href: "/shop", label: "Swag Shop" };

export default function SiteHeader({ towns }: { towns: TownNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);       // mobile sheet
  const [drop, setDrop] = useState(false);       // desktop resources menu
  const [townDrop, setTownDrop] = useState(false); // desktop towns menu
  // The mobile sheet keeps the 18-town list COLLAPSED by default. Rendering it
  // flat pushed the sheet far past the viewport, and because the header is
  // sticky the overflow was unreachable — the menu looked permanently open and
  // refused to scroll (owner-reported 2026-07-27).
  const [townsMobile, setTownsMobile] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // A town link is current only on its own page (Boone's page is "/").
  const townActive = (t: TownNavItem) => (t.href === "/" ? pathname === "/" : pathname === t.href);
  const pill = (active: boolean) =>
    cn("rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors",
      active ? "bg-orange-600 text-white" : "text-white/75 hover:bg-white/15 hover:text-white");

  return (
    <header className="sticky top-0 z-50 border-b-4 border-orange bg-teal-700">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-white.png" alt="Dave's Sweater" className="h-10 w-auto" />
        </Link>
        <span className="hidden text-[0.8rem] italic text-white/70 md:inline">
          Boone&apos;s most mostly reliable weather tracker and resource
        </span>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {primary.map((l) => (
            <Link key={l.href} href={l.href} className={pill(isActive(l.href))}>
              {l.label}
            </Link>
          ))}
          <div
            className="relative"
            onMouseEnter={() => setTownDrop(true)}
            onMouseLeave={() => setTownDrop(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setTownDrop(false); }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setTownDrop(false);
            }}
          >
            <span className="flex items-center">
              <Link href="/weather" className={cn(pill(isActive("/weather")), "pr-1.5")}>
                Towns
              </Link>
              <button
                type="button"
                aria-label="Toggle towns menu"
                aria-expanded={townDrop}
                aria-controls="towns-menu"
                onClick={() => setTownDrop((v) => !v)}
                className={cn("-ml-1 rounded-md p-1.5 transition-colors",
                  isActive("/weather") ? "text-white" : "text-white/75 hover:bg-white/15 hover:text-white")}
              >
                <ChevronDown className={cn("size-3.5 transition-transform", townDrop && "rotate-180")} aria-hidden="true" />
              </button>
            </span>
            {townDrop && (
              <div id="towns-menu"
                className="absolute right-0 top-full w-80 rounded-lg border border-white/15 bg-teal-700 p-1 shadow-lg">
                <Link href="/weather" onClick={() => setTownDrop(false)}
                  className={cn("block rounded-md px-3 py-2 text-[0.78rem] font-semibold transition-colors",
                    pathname === "/weather" ? "bg-orange-600 text-white" : "text-white hover:bg-white/15")}>
                  All towns
                </Link>
                <div className="mt-0.5 grid grid-cols-2 gap-x-1">
                  {towns.map((t) => (
                    <Link key={t.slug} href={t.href} onClick={() => setTownDrop(false)}
                      className={cn("block rounded-md px-3 py-1.5 text-[0.78rem] font-medium transition-colors",
                        townActive(t) ? "bg-orange-600 text-white" : "text-white/75 hover:bg-white/15 hover:text-white")}>
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            className="relative"
            onMouseEnter={() => setDrop(true)}
            onMouseLeave={() => setDrop(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setDrop(false); }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(false);
            }}
          >
            <span className="flex items-center">
              <Link href="/resources" className={cn(pill(isActive("/resources")), "pr-1.5")}>
                Resources
              </Link>
              <button
                type="button"
                aria-label="Toggle resources menu"
                aria-expanded={drop}
                aria-controls="resources-menu"
                onClick={() => setDrop((v) => !v)}
                className={cn("-ml-1 rounded-md p-1.5 transition-colors",
                  isActive("/resources") ? "text-white" : "text-white/75 hover:bg-white/15 hover:text-white")}
              >
                <ChevronDown className={cn("size-3.5 transition-transform", drop && "rotate-180")} aria-hidden="true" />
              </button>
            </span>
            {drop && (
              <div id="resources-menu"
                className="absolute right-0 top-full w-48 rounded-lg border border-white/15 bg-teal-700 py-1 shadow-lg">
                {resources.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setDrop(false)}
                    className={cn("block px-3 py-2 text-[0.78rem] font-medium transition-colors",
                      isActive(l.href) ? "bg-orange-600 text-white" : "text-white/75 hover:bg-white/15 hover:text-white")}>
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href={shop.href} className={pill(isActive(shop.href))}>
            {shop.label}
          </Link>
        </nav>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex size-11 items-center justify-center rounded-md text-white md:hidden">
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto overscroll-contain border-t border-white/15 px-4 py-2 md:hidden">
          {primary.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cn("rounded-md px-3 py-3 text-sm font-medium",
                isActive(l.href) ? "bg-orange-600 text-white" : "text-white/80 hover:bg-white/10")}>
              {l.label}
            </Link>
          ))}
          <div className="flex items-center">
            <Link href="/weather" onClick={() => setOpen(false)}
              className={cn("flex-1 rounded-md px-3 py-3 text-sm font-medium",
                isActive("/weather") ? "bg-orange-600 text-white" : "text-white/80 hover:bg-white/10")}>
              Towns
            </Link>
            <button type="button" aria-label={townsMobile ? "Hide town list" : "Show town list"}
              aria-expanded={townsMobile} onClick={() => setTownsMobile((v) => !v)}
              className="inline-flex size-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10">
              <ChevronDown className={cn("size-4 transition-transform", townsMobile && "rotate-180")} />
            </button>
          </div>
          {townsMobile && (
            <>
              <Link href="/weather" onClick={() => setOpen(false)}
                className={cn("rounded-md py-3 pl-8 pr-3 text-sm font-medium",
                  pathname === "/weather" ? "bg-orange-600 text-white" : "text-white/70 hover:bg-white/10")}>
                All towns
              </Link>
              {towns.map((t) => (
                <Link key={t.slug} href={t.href} onClick={() => setOpen(false)}
                  className={cn("rounded-md py-3 pl-8 pr-3 text-sm font-medium",
                    townActive(t) ? "bg-orange-600 text-white" : "text-white/70 hover:bg-white/10")}>
                  {t.name}
                </Link>
              ))}
            </>
          )}
          <Link href="/resources" onClick={() => setOpen(false)}
            className={cn("rounded-md px-3 py-3 text-sm font-medium",
              isActive("/resources") ? "bg-orange-600 text-white" : "text-white/80 hover:bg-white/10")}>
            Resources
          </Link>
          {resources.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cn("rounded-md py-3 pl-8 pr-3 text-sm font-medium",
                isActive(l.href) ? "bg-orange-600 text-white" : "text-white/70 hover:bg-white/10")}>
              {l.label}
            </Link>
          ))}
          <Link href={shop.href} onClick={() => setOpen(false)}
            className={cn("rounded-md px-3 py-3 text-sm font-medium",
              isActive(shop.href) ? "bg-orange-600 text-white" : "text-white/80 hover:bg-white/10")}>
            {shop.label}
          </Link>
        </nav>
      )}
    </header>
  );
}
