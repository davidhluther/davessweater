"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Weather" },
  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },
  { href: "/videos", label: "Videos" },
  { href: "/blog", label: "Blog" },
  { href: "/shop", label: "Swag Shop" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 flex min-h-[5.5rem] flex-wrap items-center gap-4 border-b-4 border-orange bg-teal px-6 py-2">
      <Link href="/" className="flex shrink-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.svg" alt="Dave's Sweater" className="h-12 w-auto" />
      </Link>
      <span className="hidden whitespace-nowrap text-[0.95rem] italic text-white/75 md:inline">
        Boone&apos;s most mostly reliable weather tracker and resource
      </span>
      <nav className="ml-auto flex flex-wrap justify-end gap-1">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors",
                active ? "bg-orange text-white" : "text-white/75 hover:bg-white/15 hover:text-white"
              )}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
