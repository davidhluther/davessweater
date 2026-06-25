import type { LatestForecasts } from "@/lib/types";

const ORDER = [
  "openmeteo", "apple_weather", "raysweather",
  "nws", "metno", "openweathermap", "weatherapi", "visualcrossing", "tomorrowio", "googleweather",
];

function fmtDate(d: string): string {
  const dt = new Date(d + "T12:00:00Z");
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

const deg = (v: number | null) => (v != null ? `${Math.round(v)}°` : "—");
const precip = (p: string | null) => (p && p !== "none" ? p : "none");

export default function UpcomingForecasts({ data }: { data: LatestForecasts | null }) {
  if (!data || !Object.keys(data.sources).length) return null;
  const keys = [
    ...ORDER.filter((k) => data.sources[k]),
    ...Object.keys(data.sources).filter((k) => !ORDER.includes(k)),
  ];
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Here&apos;s what each forecast says for{" "}
        <strong className="text-foreground">{fmtDate(data.date)}</strong> — logged before the actuals exist.
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
                <td className="py-2 font-medium">{f.label}</td>
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
              <div className="font-display text-sm font-bold">{f.label}</div>
              <div className="mt-1 text-xs text-muted">Hi {deg(f.high_f)} · Lo {deg(f.low_f)}</div>
              <div className="text-xs text-muted">Wind {f.wind ?? "—"}</div>
              <div className="text-xs text-muted">Precip {precip(f.precip_type)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
