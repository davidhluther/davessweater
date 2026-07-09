import Link from "next/link";
import type { HeroStats } from "@/lib/homeStats";
import BrandMark from "@/components/BrandMark";
import Scoreboard from "@/components/Scoreboard";
import ForecasterLogos from "@/components/ForecasterLogos";
import WeatherBackdrop from "@/components/WeatherBackdrop";
import { copy } from "@/content/copy";

export default function Hero({ stats, forecasters }: { stats: HeroStats; forecasters: string[] }) {
  return (
    <section className="relative isolate w-full overflow-hidden bg-teal-700 text-white">
      <WeatherBackdrop />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        <div className="mb-2 text-xs text-white/75">
          <BrandMark /> | {stats.trackingDays} days on the record
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {copy.hero.headlineLead}<span className="whitespace-nowrap text-orange">{copy.hero.headlineEmphasis}</span>
        </h1>
        <p className="mt-2 text-sm text-white/75">
          {copy.hero.dekLead}
          <Link href="/about" className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
            {copy.hero.dekLink}
          </Link>
        </p>
        <ForecasterLogos sources={forecasters} align="start" />
        <div className="mt-5 max-w-md">
          <Scoreboard sources={stats.trackingSources} />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/right-wrong-ray"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-orange-600 px-5 font-bold text-white transition-colors hover:bg-[#9a3412]">
            {copy.hero.ctaPrimary}
          </Link>
          <Link href="/methodology"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-5 font-bold text-white transition-colors hover:bg-white/10">
            {copy.hero.ctaSecondary}
          </Link>
          <Link href="/about"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-5 font-bold text-white transition-colors hover:bg-white/10">
            {copy.hero.ctaTertiary}
          </Link>
        </div>
      </div>
    </section>
  );
}
