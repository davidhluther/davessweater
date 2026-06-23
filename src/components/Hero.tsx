import Link from "next/link";
import type { HeroStats } from "@/lib/homeStats";
import BrandMark from "@/components/BrandMark";
import Scoreboard from "@/components/Scoreboard";
import IphoneShot from "@/components/IphoneShot";

export default function Hero({ stats }: { stats: HeroStats }) {
  return (
    <section className="w-full bg-teal-700 text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:py-10 md:grid-cols-[1.4fr_auto] md:items-center">
        <div>
          <div className="mb-2 text-xs text-white/75">
            <BrandMark /> · {stats.trackedDays} days on the record
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            The free forecast keeps beating the one <span className="text-orange">you pay for.</span>
          </h1>
          <IphoneShot className="my-5 md:hidden" />
          <div className="max-w-md">
            <Scoreboard sources={stats.sources} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link href="/right-wrong-ray"
              className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-5 font-bold text-white transition-colors hover:bg-[#9a3412]">
              See the full scoreboard →
            </Link>
            <Link href="/right-wrong-ray" className="text-sm text-white/70 underline-offset-2 hover:underline">
              How we score it →
            </Link>
          </div>
        </div>
        <div className="hidden md:block">
          <IphoneShot />
          <p className="mt-3 max-w-[12rem] text-xs text-white/70">
            The only weather service you need is already in your pocket.
          </p>
        </div>
      </div>
    </section>
  );
}
