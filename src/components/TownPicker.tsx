"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TownNavItem } from "@/lib/towns";
import { pickerState, townHrefOn } from "@/lib/townPicker";

// The header's one town control (owner, 2026-07-28: "Can we put the toggle/
// dropdown in the header/nav section?"). It replaces BOTH the old desktop
// "Towns" nav dropdown and the homepage TownWayfinder band, so the site has
// exactly one place to switch town and it's visible on every page, at every
// width, without scrolling.
//
// Two design rules it has to hold:
//   1. Crawlable. The panel is ALWAYS in the rendered HTML and merely hidden
//      when closed (the `hidden` attribute, not conditional rendering), so all
//      18 town links ship in the prerendered markup of every page — better link
//      discovery than the conditional dropdown it replaces. `hidden` also drops
//      the closed panel out of the tab order and the a11y tree, so nothing is
//      focusable behind the button.
//   2. Surface-aware. On a town's scoreboard the options point at other towns'
//      scoreboards; on a forecast page, at forecasts (lib/townPicker.ts).
export default function TownPicker({ towns }: { towns: TownNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { surface, slug, label } = pickerState(pathname, towns);

  // Close on outside click and on Escape. Click-to-toggle rather than the
  // hover-open the other nav menus use: this control has to work on a phone,
  // where there is no hover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative ml-auto shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="town-picker-menu"
        aria-label={`Switch town, showing ${label}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          // The mobile cap is measured, not guessed: at 390px the logo ends at
          // x=153 and the hamburger claims the right 44px, which leaves the
          // pill 160px — enough for "North Wilkesboro", the longest name in the
          // registry, without truncating or crowding the logo.
          "flex max-w-[10rem] items-center gap-1 rounded-full border py-1.5 pl-2 pr-1.5 text-[0.78rem] font-semibold transition-colors sm:max-w-[13rem]",
          open
            ? "border-white/40 bg-white/15 text-white"
            : "border-white/25 text-white hover:bg-white/15",
        )}
      >
        <MapPin className="size-3.5 shrink-0 text-orange-300" aria-hidden="true" />
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {/* No display utility on this element — the `hidden` attribute's
          display:none has to win when the panel is closed. */}
      <div
        id="town-picker-menu"
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-white/15 bg-teal-700 p-1.5 shadow-lg"
      >
        <Link
          href="/weather"
          onClick={() => setOpen(false)}
          className={cn(
            "block rounded-md px-3 py-2 text-[0.78rem] font-semibold transition-colors",
            slug === null && pathname === "/weather"
              ? "bg-orange-600 text-white"
              : "text-white hover:bg-white/15",
          )}
        >
          All towns
        </Link>
        <div className="mt-0.5 grid grid-cols-2 gap-x-1">
          {towns.map((t) => (
            <Link
              key={t.slug}
              href={townHrefOn(t.slug, surface)}
              onClick={() => setOpen(false)}
              aria-current={t.slug === slug ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-[0.78rem] font-medium transition-colors",
                t.slug === slug
                  ? "bg-orange-600 text-white"
                  : "text-white/75 hover:bg-white/15 hover:text-white",
              )}
            >
              {t.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
