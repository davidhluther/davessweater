// The official GMHG field map (public/assets/gmhg-field-map.webp, the full 2026
// map) with your selected events dropped on top as numbered, time-labeled pins,
// placed on the actual area each event happens in. Coordinates are fractions of
// the image, so they scale with it. Pass no pins to show it as a plain reference.

export interface FieldPin {
  n: number;
  zone: string | null;
  venue?: string; // disambiguates the groves/stage, which sit far apart
  time: string; // "9:30 AM", or "Shuttle" for the shuttle pin
}

export const MAP_SRC = "/assets/gmhg-field-map.webp";
export const MAP_ASPECT = 1220 / 1700; // height / width of the asset

export const SHUTTLE_ZONE = "shuttle";
export const SHUTTLE_ACCESSIBLE_ZONE = "shuttle_accessible";
export const SHUTTLE_LABEL = "Shuttle";

// Fraction (0–1) of the map image where each dataset zone sits, matched to the
// real 2026 map. Tuned against public/assets/gmhg-field-map.webp.
export const MAP_XY: Record<string, [number, number]> = {
  dance: [0.49, 0.25],
  review_stand: [0.60, 0.13],
  center_field: [0.60, 0.37],
  field_left: [0.45, 0.38],
  field_right: [0.72, 0.34],
  hillside_infield: [0.78, 0.31],
  athletics_tent: [0.79, 0.15],
  music_groves: [0.45, 0.08], // fallback for grove events with an unknown venue
  preacher_rock: [0.13, 0.11],
  worship: [0.10, 0.17],
  harp_fiddle: [0.35, 0.46],
  gaelic: [0.39, 0.59],
  childrens: [0.38, 0.63],
  cultural_village: [0.45, 0.71],
  shuttle: [0.07, 0.31], // Gate 1 shuttle drop-off / pickup (general lots)
  shuttle_accessible: [0.87, 0.42], // Gate 3 / Handicap Shuttle Tent (accessible transport)
  offsite: [0.05, 0.93], // corner marker; off-mountain events are styled as such
};

// The Celtic Groves and Alex Beaton stage share one dataset zone but sit far
// apart, so they are keyed by venue to their own spots.
const VENUE_XY: Record<string, [number, number]> = {
  "Grove I": [0.45, 0.08],        // Celtic Grove #1, top center-left
  "Grove II": [0.82, 0.07],       // Celtic Grove #2, top right
  "Alex Beaton Stage": [0.93, 0.29], // Alex Beaton Memorial Stage, far right
};

/** Fraction position for a pin, preferring the venue-specific spot when known. */
export function pinXY(zone: string | null, venue?: string): [number, number] {
  if (venue && VENUE_XY[venue]) return VENUE_XY[venue];
  return MAP_XY[zone ?? ""] ?? [0.06, 0.92];
}

interface Placed { n: number; x: number; y: number; time: string; zone: string | null }

/** Fan pins that share a spot into a small ring so numbers do not stack. */
function spread(pins: FieldPin[]): Placed[] {
  const base = pins.map((p) => {
    const [x, y] = pinXY(p.zone, p.venue);
    return { n: p.n, x, y, time: p.time, zone: p.zone };
  });
  const counts = new Map<string, number>();
  for (const p of base) { const k = `${p.x},${p.y}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const seen = new Map<string, number>();
  return base.map((p) => {
    const k = `${p.x},${p.y}`;
    const total = counts.get(k)!;
    if (total === 1) return p;
    const i = seen.get(k) ?? 0; seen.set(k, i + 1);
    const ang = (Math.PI * 2 * i) / total - Math.PI / 2;
    return { ...p, x: p.x + Math.cos(ang) * 0.03, y: p.y + Math.sin(ang) * 0.045 };
  });
}

export default function FieldMap({ pins = [] }: { pins?: FieldPin[] }) {
  const placed = spread(pins);
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MAP_SRC} loading="eager"
        alt="MacRae Meadows field map: The oval track and East Meadow, Highland Dancing and Review Stand along the top, the Celtic Groves and Alex Beaton stage and bagpiping to the east, merchant and culture tents to the west and south, gates and shuttle drop-offs around the edge."
        className="block w-full" />
      {placed.map((p) => {
        const off = p.zone === "offsite";
        return (
          <div key={p.n} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
            <span className={`flex h-[1.1rem] w-[1.1rem] items-center justify-center rounded-full text-[0.6rem] font-bold text-white ring-2 ring-white print:h-[0.78rem] print:w-[0.78rem] print:border print:border-black print:bg-white print:text-[0.5rem] print:text-black print:ring-0 ${off ? "bg-slate-500" : "bg-teal-700"}`}>{p.n}</span>
            <span className="mt-[1px] whitespace-nowrap rounded bg-white/90 px-1 text-[0.55rem] font-bold leading-tight text-teal-900 ring-1 ring-black/10 print:px-0.5 print:text-[0.42rem] print:text-black print:ring-black/40">{off ? "off-site" : p.time}</span>
          </div>
        );
      })}
    </div>
  );
}
