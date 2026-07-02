"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Today" },
  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },
  { href: "/fireworks", label: "Fireworks" },
  { href: "/videos", label: "Videos" },
  { href: "/blog", label: "Blog" },
  { href: "/shop", label: "Swag Shop" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
        <nav className="ml-auto hidden gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={cn("rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors",
                isActive(l.href) ? "bg-orange-600 text-white" : "text-white/75 hover:bg-white/15 hover:text-white")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex size-11 items-center justify-center rounded-md text-white md:hidden">
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/15 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cn("rounded-md px-3 py-3 text-sm font-medium",
                isActive(l.href) ? "bg-orange-600 text-white" : "text-white/80 hover:bg-white/10")}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
