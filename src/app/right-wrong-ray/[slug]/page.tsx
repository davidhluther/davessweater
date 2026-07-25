import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  listPublicTowns, getTown, getTownScores, getTownComparison,
  latestComparisonDate, isTownPublic,
} from "@/lib/towns";
import { scoreboardRows } from "@/lib/scoreboard";
import { sparkSeries, rollingMean } from "@/lib/sparkline";
import { sourceLabel } from "@/lib/townDisplay";
import { actualLines } from "@/lib/homeStats";
import { fmtLongDate } from "@/lib/dates";
import { FORECASTERS } from "@/lib/forecasters";
import { breadcrumbs, SITE_BASE } from "@/lib/schema";
import { cn } from "@/lib/utils";
import SectionBand from "@/components/SectionBand";
import SortableScoreTable, { type ScoreRow } from "@/components/SortableScoreTable";
import VerdictScale from "@/components/VerdictScale";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import TownSwitcher from "@/components/TownSwitcher";
import JsonLd from "@/components/JsonLd";
import type { SourceEntry } from "@/lib/types";

// Same gate as the forecast pages: only public non-Boone towns get a board here
// (Boone's board is /right-wrong-ray). A town crossing MIN_SCORED_DAYS appears
// on the next build, no code change.
export const dynamicParams = false;

export async function generateStaticParams() {
  const towns = await listPublicTowns();
  return towns.filter((t) => t.slug !== "boone").map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const town = await getTown(slug);
  if (!town) return { title: "Forecast accuracy scoreboard" };
  const title = `${town.name} forecast accuracy scoreboard`;
  const description =
    `Daily accuracy scores for every ${town.name}, NC forecast${town.has_rays ? ", Ray's Weather included" : ""} ` +
    `— graded against verified actuals on a 100-point scale. Same rubric as Boone.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/right-wrong-ray/${slug}`,
      types: {
        "application/rss+xml": [
          { url: `/feed/${slug}/verdict.xml`, title: `Dave's Sweater | ${town.name} Right/Wrong Ray` },
        ],
      },
    },
    openGraph: {
      title, description, type: "website",
      url: `https://davessweater.com/right-wrong-ray/${slug}`,
    },
    twitter: { card: "summary_large_image" },
  };
}

const EXTRA_META: Record<string, { label: string; iconSrc?: string; iconChar?: string }> = {
  raysweather: { label: "Ray's Weather", iconSrc: "/assets/ray_face.svg" },
  apple_weather: { label: "Apple Weather", iconChar: "📱" },
  composite: { label: "Dave's Sweater Index" },
};
function srcMeta(key: string): { label: string; iconSrc?: string; iconChar?: string; price: string } {
  const f = FORECASTERS[key];
  const base = f ? { label: f.label, iconSrc: f.logo } : (EXTRA_META[key] ?? { label: sourceLabel(key) });
  return { ...base, price: key === "raysweather" ? "Paid" : "Free" };
}

function predFields(e: SourceEntry): { hiLo: string; wind: string; rain: string } {
  const p = e.prediction;
  const hi = p.today_high_f ?? p.high_f, lo = p.tonight_low_f ?? p.low_f;
  const wind = p.wind_mph, rain = p.precip_in ?? p.rainfall_in;
  return {
    hiLo: `${hi ?? "—"}° / ${lo ?? "—"}°`,
    wind: wind != null ? `${Math.round(wind * 10) / 10} mph` : "—",
    rain: rain != null ? `${rain}"` : "—",
  };
}
function barColor(s: number): string {
  return s >= 75 ? "bg-green" : s >= 60 ? "bg-slate-400" : "bg-orange-600";
}

export default async function TownBoard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = await getTown(slug);
  if (!town || slug === "boone" || !(await isTownPublic(slug))) notFound();

  const [scores, latestDate, publicTowns] = await Promise.all([
    getTownScores(slug), latestComparisonDate(slug), listPublicTowns(),
  ]);
  const comp = latestDate ? await getTownComparison(slug, latestDate) : null;

  // Season scoreboard — every source tracked for this town, ranked by average.
  // Sparklines run over ALL the town's scored days (requireRays:false) so a
  // no-Ray town still gets a trend line.
  const allRows = scoreboardRows(scores);
  const spark = sparkSeries(scores, allRows.map((r) => r.key), { requireRays: false });
  const rows: ScoreRow[] = allRows.map((r) => ({
    key: r.key,
    label: r.label,
    isFree: r.key !== "raysweather",
    own: r.key === "composite",
    record: r.record,
    avg: r.avg,
    days: r.days,
    spark: rollingMean(spark[r.key] ?? []),
  }));
  const dsiRow = allRows.find((r) => r.key === "composite") ?? null;
  const dsiRank = dsiRow
    ? [...allRows].sort((x, y) => y.avg - x.avg).findIndex((r) => r.key === "composite") + 1
    : null;
  const trackedDays = Math.max(0, ...allRows.map((r) => r.days));

  // Latest scored day: leaderboard by score, tie-break on summed miss.
  const missTotal = (score: SourceEntry["score"]): number => {
    let sum = 0, n = 0;
    for (const f of Object.values(score.breakdown ?? {})) {
      if (f.scored && typeof f.error === "number") { sum += Math.abs(f.error); n++; }
    }
    return n ? sum : Number.MAX_SAFE_INTEGER;
  };
  const dsiDay = comp?.sources?.composite;
  const scored = Object.keys(comp?.sources ?? {})
    .filter((key) => key !== "composite")
    .map((key) => ({ key, ...srcMeta(key), e: comp!.sources![key] }))
    .filter((s): s is typeof s & { e: SourceEntry & { score: NonNullable<SourceEntry["score"]> } } =>
      Boolean(s.e && s.e.score))
    .sort((x, y) =>
      y.e.score.score - x.e.score.score ||
      missTotal(x.e.score) - missTotal(y.e.score) ||
      x.label.localeCompare(y.label));
  const bestScore = scored[0]?.e.score.score;
  const worstScore = scored[scored.length - 1]?.e.score.score;
  const markWorst = scored.length > 2 && worstScore !== bestScore;

  const a = comp?.actuals;
  const aLines = a ? actualLines(a) : [];
  const actualMain = aLines.slice(0, 3).join(" | ");
  const actualCond = aLines[3];

  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Right Ray / Wrong Ray", path: "/right-wrong-ray" },
      { name: town.name, path: `/right-wrong-ray/${slug}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${town.name}, NC forecast accuracy scores`,
      description:
        `Daily accuracy scores comparing every tracked forecast for ${town.name}, NC against verified ` +
        `actual conditions on a 100-point scale.`,
      creator: { "@type": "Organization", name: "Dave's Sweater", url: SITE_BASE },
      isAccessibleForFree: true,
      license: "https://creativecommons.org/licenses/by/4.0/",
      url: `${SITE_BASE}/right-wrong-ray/${slug}`,
      keywords: [`${town.name} NC weather`, "forecast accuracy"],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:py-11">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
                <Link href="/right-wrong-ray" className="hover:underline">Right Ray / Wrong Ray</Link>
                {" | "}{trackedDays} days on the record
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {town.name} scoreboard
              </h1>
            </div>
            <TownSwitcher towns={publicTowns} current={slug} base="right-wrong-ray" />
          </div>
          <p className="mt-3 max-w-2xl text-sm text-white/70">
            Every forecast for {town.name}, graded against what the sky actually did &mdash; same 100-point
            rubric as Boone, scored at {town.name}&apos;s own coordinates.
            {town.has_rays
              ? " Ray's Weather runs a station here, so his forecast is in the mix."
              : " Ray's Weather runs no station here, so his row is honestly absent."}
          </p>
          <p className="mt-4">
            <Link
              href={`/weather/${slug}`}
              className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              {town.name}&apos;s forecast &rarr;
            </Link>
          </p>
        </div>
      </section>

      {dsiRow && (
        <SectionBand tone="surface">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Our forecast</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Dave&apos;s Sweater Index</h2>
            {dsiRank && (
              <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-muted">
                #{dsiRank} of {allRows.length}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The free forecasters below, averaged into one number for {town.name}
            {" "}&mdash; then graded by the same rubric as every one of them.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
            <div className="rounded-xl border border-border bg-background px-3 py-3">
              <div className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{dsiRow.avg.toFixed(1)}</div>
              <div className="mt-0.5 text-xs text-muted">season avg / 100</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-3">
              <div className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{dsiRow.record.split(" ")[0]}</div>
              <div className="mt-0.5 text-xs text-muted">graded Right</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-3">
              <div className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{dsiRow.days}</div>
              <div className="mt-0.5 text-xs text-muted">days scored</div>
            </div>
          </div>
        </SectionBand>
      )}

      {rows.length > 0 && (
        <section className="w-full bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
            <h2 className="font-display mb-1 text-2xl font-bold">{town.name} Season Scoreboard</h2>
            <p className="mb-4 text-sm text-white/70">
              Every forecaster tracked for {town.name}, ranked by season average &mdash; our own{" "}
              <span className="font-semibold text-white/90">Dave&apos;s Sweater Index</span> (marked{" "}
              <span className="font-semibold text-emerald-300">ours</span>) in the mix. Merit order.
            </p>
            <SortableScoreTable rows={rows} />
            <p className="mt-3 text-xs text-white/70">
              R = graded Right (75+) | M = Meh (60&ndash;74) | W = graded Wrong (under 60). Trend = 7-day
              rolling average on the 0&ndash;100 scale.
            </p>
          </div>
        </section>
      )}

      <SectionBand tone="surface">
        {comp ? (
          <>
            <h2 className="font-display text-2xl font-bold">
              Latest scored day{comp.date ? <span className="text-muted"> | {fmtLongDate(comp.date)}</span> : null}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {town.name}&apos;s forecasts, graded against what actually happened. The math is under each score.
            </p>

            {a && (
              <div className="mt-4 rounded-2xl bg-teal-900 p-5 text-white sm:p-6 [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-white/60">
                  What actually happened
                </div>
                <div className="mt-1.5 font-display text-lg font-bold sm:text-2xl">{actualMain}</div>
                {actualCond && <div className="mt-1 text-sm text-white/70">{actualCond}</div>}
              </div>
            )}

            {scored.map(({ key, label, iconSrc, iconChar, price, e }, i) => {
              const s = e.score.score;
              const isBest = i === 0;
              const isWorst = markWorst && i === scored.length - 1;
              const f = predFields(e);
              return (
                <div key={key}
                  className={cn(
                    "mt-3 rounded-2xl border bg-background p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6",
                    isBest ? "border-emerald-300/70" : isWorst ? "border-orange-300/70" : "border-border",
                  )}>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {iconSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconSrc} alt="" className="inline h-5 w-5 rounded-sm object-contain align-middle" />
                      ) : iconChar ? (
                        <span aria-hidden="true">{iconChar}</span>
                      ) : null}
                      <span className="font-display text-base font-bold sm:text-lg">{label}</span>
                      {isBest && (
                        <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          day&apos;s best
                        </span>
                      )}
                      {isWorst && (
                        <span className="rounded-full border border-orange-600/40 bg-orange-600/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                          day&apos;s worst
                        </span>
                      )}
                    </span>
                    <span className="justify-self-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                      {price}
                    </span>
                    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <VerdictScale score={s} />
                      <span className="font-display text-2xl font-bold sm:text-3xl">
                        {s.toFixed(1)}<span className="text-sm font-normal text-muted">/100</span>
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
                    <div className={cn("h-full rounded-full", barColor(s))} style={{ width: `${Math.max(2, Math.min(100, s))}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
                    <div>
                      <div className="text-xs text-muted">Predicted hi / lo</div>
                      <div className="mt-0.5 font-medium">{f.hiLo}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Wind</div>
                      <div className="mt-0.5 font-medium">{f.wind}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Rain</div>
                      <div className="mt-0.5 font-medium">{f.rain}</div>
                    </div>
                  </div>
                  <details className="group mt-4">
                    <summary className="inline-flex cursor-pointer list-none items-center rounded text-sm font-medium text-teal [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Show the math &darr;</span>
                      <span className="hidden group-open:inline">Hide the math &uarr;</span>
                    </summary>
                    <div className="mt-2">
                      <ScoreBreakdown score={e.score} />
                    </div>
                  </details>
                </div>
              );
            })}
            {dsiDay?.score && (
              <p className="mt-4 text-sm text-muted">
                Dave&apos;s Sweater Index for this day:{" "}
                <span className="font-display text-lg font-bold tabular-nums text-foreground">
                  {dsiDay.score.score.toFixed(1)}<span className="text-sm font-normal text-muted">/100</span>
                </span>
                {typeof dsiDay.prediction?.member_count === "number" && ` from ${dsiDay.prediction.member_count} forecasters`}.
              </p>
            )}
          </>
        ) : <p className="text-muted">No scored day for {town.name} yet.</p>}
        <p className="mt-5 text-xs">
          <Link href="/methodology" className="text-teal underline underline-offset-2">Full methodology</Link>
          {" | "}
          <Link href="/weather" className="text-teal underline underline-offset-2">All towns</Link>
        </p>
      </SectionBand>
    </>
  );
}
