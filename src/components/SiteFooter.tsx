import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-teal-900 text-white/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center">
        <span>Dave&apos;s Sweater · Boone, NC · <span className="italic">Boone&apos;s most mostly reliable weather tracker and resource</span></span>
        <span className="sm:ml-auto">
          <Link href="/methodology" className="text-white/85 underline-offset-2 hover:underline">How we score it</Link>
          <span className="mx-2">·</span>Not affiliated with, endorsed by, or on speaking terms with Ray&apos;s Weather
        </span>
      </div>
    </footer>
  );
}
