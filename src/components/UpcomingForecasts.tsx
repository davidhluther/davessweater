import type { LatestForecasts } from "@/lib/types";
import { MIN_SCORED_DAYS } from "@/lib/gating";

const ORDER = [
  "composite", "openmeteo", "apple_weather", "raysweather",
  "nws", "metno", "openweathermap", "weatherapi", "visualcrossing", "tomorrowio", "googleweather",
];

function fmtDate(d: string): string {
  const dt = new Date(d + "T12:00:00Z");
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const deg = (v: number | null) => (v != null ? `${Math.round(v)}°` : "—");

// Precip labels read as words, not raw enum values. The pipeline's type vocabulary
// is deliberately small (it has to be gradable against an observed amount), so the
// display layer is where "none" becomes "No precip" and mixed becomes something a
// person would say (owner, 2026-07-27: "Precip rain" needed styling and a wider
// vocabulary). Unknown values pass through capitalized rather than being dropped.
const PRECIP_LABEL: Record<string, string> = {
  none: "No precip",
  rain: "Rain",
  snow: "Snow",
  sleet: "Sleet",
  mixed: "Wintry mix",
  freezing_rain: "Freezing rain",
  drizzle: "Drizzle",
  storm: "Storms",
};
const precip = (p: string | null): string => {
  if (!p) return "No precip";
  return PRECIP_LABEL[p] ?? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ");
};

function NewTag() {
  return (
    <span title={`Provisional: fewer than ${MIN_SCORED_DAYS} scored days`}
      className="ml-1.5 rounded bg-border px-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
      new
    </span>
  );
}

export default function UpcomingForecasts(
  { data, provisional }: { data: LatestForecasts | null; provisional?: Set<string> },
) {
  if (!data || !Object.keys(data.sources).length) return null;
  const isNew = (k: string) => provisional?.has(k) ?? false;
  const keys = [
    ...ORDER.filter((k) => data.sources[k]),
    ...Object.keys(data.sources).filter((k) => !ORDER.includes(k)),
  ];
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Here&apos;s what each forecast says for{" "}
        <strong className="text-foreground">{fmtDate(data.date)}</strong>: Logged before the actuals exist.
        Come back once the day&apos;s in to see who was right.
      </p>

      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-2">Source</th><th>High</th><th>Low</th><th>Wind</th><th>Precip</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const f = data.sources[k];
            return (
              <tr key={k} className="border-t border-border">
                <td className="py-2 font-medium">{f.label}{isNew(k) && <NewTag />}</td>
                <td>{deg(f.high_f)}</td>
                <td>{deg(f.low_f)}</td>
                <td>{f.wind ?? "—"}</td>
                <td>{precip(f.precip_type)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {keys.map((k) => {
          const f = data.sources[k];
          return (
            <div key={k} className="rounded-xl border border-border bg-background p-3">
              <div className="font-display text-sm font-bold">{f.label}{isNew(k) && <NewTag />}</div>
              <dl className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Hi / Lo</dt>
                  <dd className="font-medium text-foreground tabular-nums">{deg(f.high_f)} / {deg(f.low_f)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Wind</dt>
                  <dd className="font-medium text-foreground tabular-nums">{f.wind ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Precip</dt>
                  <dd className="font-medium text-foreground">{precip(f.precip_type)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
