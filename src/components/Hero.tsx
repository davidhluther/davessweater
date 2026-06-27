import Link from "next/link";
import type { HeroStats } from "@/lib/homeStats";
import BrandMark from "@/components/BrandMark";
import Scoreboard from "@/components/Scoreboard";
import IphoneShot from "@/components/IphoneShot";
import CompositeForecast from "@/components/CompositeForecast";

export default function Hero({ stats }: { stats: HeroStats }) {
  return (
    <section className="w-full bg-teal-700 text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:py-10 md:grid-cols-[1.4fr_auto] md:items-center">
        <div>
          <div className="mb-2 text-xs text-white/75">
            <BrandMark /> · {stats.trackingDays} days on the record
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            The free forecast keeps beating the one <span className="text-orange">you pay for.</span>
          </h1>
          <IphoneShot className="my-5 md:hidden" />
          <div className="max-w-md">
            <Scoreboard sources={stats.trackingSources} />
          </div>
          <div className="mt-5 flex justify-center">
            <Link href="/right-wrong-ray"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-orange-600 px-5 font-bold text-white transition-colors hover:bg-[#9a3412]">
              See the full scoreboard
            </Link>
          </div>
        </div>
        <div className="hidden md:block">
          <IphoneShot />
          <p className="mt-3 max-w-[12rem] text-xs text-white/70">
            The only weather service you need is already in your pocket.
          </p>
        </div>
        <div className="md:col-span-2">
          <CompositeForecast />
        </div>
      </div>
    </section>
  );
}
