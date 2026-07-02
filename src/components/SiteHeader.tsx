"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Top-level stays lean; everything editorial lives under the Resources
// dropdown (the label itself links to the /resources hub).
const primary = [
  { href: "/", label: "Today" },
  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },
  { href: "/fireworks", label: "Fireworks" },
];
const resources = [
  { href: "/resources/articles", label: "Articles" },
  { href: "/resources/news", label: "News & Updates" },
  { href: "/resources/videos", label: "Videos" },
  { href: "/resources/reports", label: "Reports" },
];
const shop = { href: "/shop", label: "Swag Shop" };

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);       // mobile sheet
  const [drop, setDrop] = useState(false);       // desktop resources menu
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
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
        <nav className="flex flex-col gap-1 border-t border-white/15 px-4 py-2 md:hidden">
          {[...primary, { href: "/resources", label: "Resources" }].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cn("rounded-md px-3 py-3 text-sm font-medium",
                isActive(l.href) ? "bg-orange-600 text-white" : "text-white/80 hover:bg-white/10")}>
              {l.label}
            </Link>
          ))}
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
