import type { RainHour } from "@/lib/forecast5";

// A compact rain-timing sparkline for a single 5-day strip card: bar height is
// the chance of rain that hour, and a filled (vs faint) bar marks hours with
// measurable rain. Same teal look as the GMHG planner's HourlyRain, but
// label-light so it stays legible at one-fifth of the strip's width. Pure SVG,
// no client JS — the timing is Open-Meteo's hourly (the only sub-daily source).

function fmtHour(h: number): string {
  const ap = h < 12 ? "a" : "p";
  return `${((h + 11) % 12) + 1}${ap}`;
}

export default function RainTimingBar({ hours }: { hours: RainHour[] }) {
  if (!hours.length) return null;
  const W = 240, H = 34, padL = 3, padB = 8, padT = 3;
  const bw = (W - 2 * padL) / hours.length;
  const first = hours[0].hour, last = hours[hours.length - 1].hour;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Rain chance by hour, ${fmtHour(first)} to ${fmtHour(last)} (Open-Meteo)`}
      className="h-auto w-full">
      <line x1={padL} y1={H - padB} x2={W - padL} y2={H - padB} stroke="var(--border)" strokeWidth="0.5" />
      {hours.map((h, i) => {
        const bh = Math.max(0.6, (H - padB - padT) * (h.prob / 100));
        return (
          <rect key={i} x={padL + i * bw + 0.5} y={H - padB - bh} width={bw - 1} height={bh} rx="0.6"
            fill="var(--teal)" opacity={h.inches >= 0.01 ? 0.95 : 0.32} />
        );
      })}
      <text x={padL} y={H - 1.5} textAnchor="start" fontSize="5.5" fill="var(--muted)">{fmtHour(first)}</text>
      <text x={W - padL} y={H - 1.5} textAnchor="end" fontSize="5.5" fill="var(--muted)">{fmtHour(last)}</text>
    </svg>
  );
}
