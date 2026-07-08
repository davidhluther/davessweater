import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-teal-900 text-white/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-4 py-6 text-xs">
        <div>
          Dave&apos;s Sweater | Boone, NC |{" "}
          <span className="italic">Boone&apos;s most mostly reliable weather tracker and resource</span>
        </div>
        <div>
          <Link href="/about" className="text-white/85 underline underline-offset-2">What this is</Link>
          <span className="mx-2">|</span>
          <Link href="/methodology" className="text-white/85 underline underline-offset-2">How we score it</Link>
          <span className="mx-2">|</span>Not affiliated with or endorsed by Ray&apos;s Weather. We just check the math.
        </div>
      </div>
    </footer>
  );
}
