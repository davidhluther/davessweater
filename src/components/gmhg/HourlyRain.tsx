// A small bar chart of when rain is forecast and roughly how much, across the
// event window (7 AM to 10 PM). Bar height is the chance of rain that hour;
// darker/fuller bars mark hours with measurable rain. Pure SVG, no deps.

export interface RainHour {
  hour: number;   // 0–23 local
  prob: number;   // % chance of precipitation
  inches: number; // precipitation amount that hour
}

function fmtHour(h: number): string {
  const ap = h < 12 ? "a" : "p";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}${ap}`;
}

export default function HourlyRain({ hours }: { hours: RainHour[] }) {
  if (!hours.length) return null;
  const W = 300, H = 52, padL = 5, padB = 11, padT = 4;
  const bw = (W - 2 * padL) / hours.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chance of rain by hour across the day"
      className="h-auto w-full">
      <line x1={padL} y1={H - padB} x2={W - padL} y2={H - padB} stroke="var(--border)" strokeWidth="0.4" />
      {hours.map((h, i) => {
        const bh = Math.max(0.6, (H - padB - padT) * (h.prob / 100));
        const x = padL + i * bw;
        const wet = h.inches >= 0.01;
        return (
          <rect key={i} x={x + 0.6} y={H - padB - bh} width={bw - 1.2} height={bh} rx="0.6"
            fill="var(--teal)" opacity={wet ? 0.95 : 0.35} />
        );
      })}
      {hours.map((h, i) => (h.hour % 3 === 0 ? (
        <text key={`l${i}`} x={padL + i * bw + bw / 2} y={H - 3} textAnchor="middle" fontSize="5" fill="var(--muted)">{fmtHour(h.hour)}</text>
      ) : null))}
    </svg>
  );
}
