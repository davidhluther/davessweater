// Render the plan to a PNG on a canvas. No libraries, no printer, no PDF. The
// client shows the result inline so a phone user can press-and-hold to save it
// to Photos. Native canvas text plus the official field map (same-origin, so it
// rasterizes without tainting the canvas), with each day's events dropped on the
// map as numbered pins.
import type { GmhgEvent } from "@/lib/types";
import type { DayPlan } from "@/lib/gmhg/plan";
import { packingFor, type DayForecast } from "@/lib/gmhg/packing";
import { MAP_ASPECT, MAP_SRC, pinXY, SHUTTLE_ACCESSIBLE_ZONE, SHUTTLE_LABEL, SHUTTLE_ZONE } from "@/components/gmhg/FieldMap";
import { DAY_LABEL, DAY_ORDER, DAY_SHORT, fmtClock, fmtClockStr, toMinutes } from "@/lib/gmhg/schedule";

export interface PlanImageInput {
  events: GmhgEvent[];
  planByDay: Record<string, DayPlan>;
  cost: { totalUsd: number; shuttleDays: number };
  forecast: Record<string, DayForecast> | null;
  checkedAt: string | null;
  originLabel: string;
  accessible: boolean;
  lastShuttleByDay: Record<string, string | null>;
}

const W = 1040;
const PAD = 56;
const INK = "#26323d";
const MUTED = "#5f6b75";
const TEAL = "#33485a";
const ORANGE = "#c2410c";
const font = (size: number, weight = 400) => `${weight} ${size}px Inter, system-ui, Arial, sans-serif`;

interface TextOp { kind: "text"; x: number; y: number; text: string; font: string; color: string }
interface MapPin { n: number; fx: number; fy: number; time: string }
interface MapOp { kind: "map"; x: number; y: number; w: number; h: number; pins: MapPin[] }
type Op = TextOp | MapOp;

const round = (n: number | null): string => (n == null ? "?" : String(Math.round(n)));

/** Per-day pins on the map, co-located ones fanned into a small ring. The
 *  shuttle drop-off is appended as the final pin (skipped on concert days). */
function dayPins(evs: GmhgEvent[], concertOnly: boolean, accessible: boolean): MapPin[] {
  const raw: { n: number; zone: string; venue?: string; time: string }[] =
    evs.map((e, i) => ({ n: i + 1, zone: e.zone ?? "", venue: e.venue, time: fmtClockStr(e.start) }));
  if (!concertOnly) raw.push({ n: evs.length + 1, zone: accessible ? SHUTTLE_ACCESSIBLE_ZONE : SHUTTLE_ZONE, time: SHUTTLE_LABEL });
  const base = raw.map((p) => {
    const [fx, fy] = pinXY(p.zone, p.venue);
    return { n: p.n, fx, fy, time: p.time };
  });
  const counts = new Map<string, number>();
  for (const p of base) { const k = `${p.fx},${p.fy}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const seen = new Map<string, number>();
  return base.map((p) => {
    const k = `${p.fx},${p.fy}`;
    const total = counts.get(k)!;
    if (total === 1) return p;
    const i = seen.get(k) ?? 0; seen.set(k, i + 1);
    const ang = (Math.PI * 2 * i) / total - Math.PI / 2;
    return { ...p, fx: p.fx + Math.cos(ang) * 0.032, fy: p.fy + Math.sin(ang) * 0.05 };
  });
}

/** Draw the plan and return a data URL (PNG). Async so the map can rasterize. */
export async function planImageDataUrl(input: PlanImageInput): Promise<string> {
  const mapImg = new Image();
  mapImg.src = MAP_SRC;
  let hasMap = false;
  try { await mapImg.decode(); hasMap = mapImg.naturalWidth > 0; } catch { hasMap = false; }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const ops: Op[] = [];
  let y = 0;

  const wrap = (text: string, maxW: number, f: string): string[] => {
    ctx.font = f;
    const out: string[] = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const t = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = word; }
      else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };
  const write = (text: string, size: number, weight: number, color: string, x = PAD, gapAfter = 6) => {
    const f = font(size, weight);
    for (const ln of wrap(text, W - PAD - x, f)) {
      ops.push({ kind: "text", x, y, text: ln, font: f, color });
      y += size * 1.32;
    }
    y += gapAfter;
  };

  y = PAD + 34;
  write("Your Highland Games plan, 2026", 30, 700, INK, PAD, 2);
  write("Grandfather Mountain Highland Games, MacRae Meadows", 17, 400, MUTED, PAD, 14);
  if (input.cost.shuttleDays > 0) {
    write(`Shuttle total $${input.cost.totalUsd}. $10/seat round trip, cards or cash at the lot.`, 19, 700, ORANGE, PAD, 12);
  }

  if (input.forecast) {
    const bits = DAY_ORDER
      .map((d) => {
        const fc = input.forecast![d];
        if (!fc) return null;
        const rain = fc.precipProbMaxPct != null ? `, rain ${round(fc.precipProbMaxPct)}%` : "";
        return `${DAY_SHORT[d]} ${round(fc.tempMaxF)}/${round(fc.tempMinF)}${rain}`;
      })
      .filter(Boolean)
      .join("     ");
    if (bits) write(`Weather:  ${bits}`, 16, 400, INK, PAD, 2);
  }
  write(input.checkedAt ? `Forecast checked ${input.checkedAt}. Mountain weather changes fast; check again the morning you go.` : "Check the forecast again the morning you go; mountain weather changes fast.", 14, 400, MUTED, PAD, 2);
  write(`"Leave by" times start from ${input.originLabel} and include the drive, the shuttle line, the ride up, and the walk in.`, 14, 400, MUTED, PAD, 16);

  const days = DAY_ORDER.filter((d) => input.events.some((e) => e.day === d));
  for (const day of days) {
    const evs = input.events.filter((e) => e.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const plan = input.planByDay[day];
    const fc = input.forecast?.[day] ?? null;
    y += 6;
    write(`${DAY_LABEL[day]}, July ${Number(day.slice(-2))}`, 22, 700, TEAL, PAD, 3);
    if (fc) write(`Forecast: High ${round(fc.tempMaxF)}°  |  Low ${round(fc.tempMinF)}°  |  Rain ${round(fc.precipProbMaxPct)}%`, 15, 400, MUTED, PAD, 4);

    if (plan?.concertOnly) {
      write("Concert night. Drive up onto MacRae Meadows after 5 PM (gates 6 PM). No shuttle.", 17, 400, INK, PAD, 4);
    } else if (plan) {
      const bits: string[] = [];
      if (plan.leaveByMin != null) bits.push(`Leave ${input.originLabel} by ${fmtClock(plan.leaveByMin)}`);
      if (plan.lot) bits.push(`Park at ${plan.lot}`);
      bits.push("Shuttle $10/seat, cards or cash");
      write(bits.join("  |  "), 17, 400, INK, PAD, 4);
    }

    evs.forEach((e, i) => {
      write(`${i + 1}.  ${fmtClockStr(e.start)}   ${e.title}  (${e.venue})`, 17, 400, INK, PAD + 6, 2);
    });
    if (!plan?.concertOnly) {
      write(`${evs.length + 1}.  ${SHUTTLE_LABEL} (drop-off and pickup at ${input.accessible ? "Gate 3, accessible transport" : "Gate 1"})`, 17, 400, INK, PAD + 6, 2);
    }

    const hasEarlyOrLate = evs.some((e) => { const m = toMinutes(e.start); return m < 9 * 60 || m >= 18 * 60; });
    write("Pack: " + packingFor(fc, hasEarlyOrLate), 15, 400, MUTED, PAD, 6);

    // The field map for the day, with the day's numbered pins.
    if (hasMap) {
      const w = W - 2 * PAD;
      const h = w * MAP_ASPECT;
      ops.push({ kind: "map", x: PAD, y, w, h, pins: dayPins(evs, !!plan?.concertOnly, input.accessible) });
      y += h + 6;
    }

    const last = input.lastShuttleByDay[day];
    if (!plan?.concertOnly && last) {
      write(`Last shuttle back leaves ${last}. Do not get stranded on the mountain.`, 15, 700, ORANGE, PAD, 14);
    } else {
      y += 10;
    }
  }

  y += 6;
  write("Good to know: EMS/First Aid tent on the field. Card readers are everywhere now, including the shuttle, though cash still works. Little rain shelter beyond the Patron tent, vendor tents, and trees, so pack rain gear. Coolers are welcome, and there is plenty of grassy hillside for chairs and blankets.", 14, 400, MUTED, PAD, 6);
  write("Games office (828) 733-1333. No pets (ADA service animals only). Accessible transport: Newland Elementary (Fri to Sun), Avery County HS (Thu).", 14, 400, MUTED, PAD, 2);
  write("Walk and drive times are estimates, not a promise. Grandfather makes its own weather. davessweater.com", 14, 400, MUTED, PAD, 0);

  const H = y + PAD;
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#33485a";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(0, 10, W, 3);
  ctx.textBaseline = "alphabetic";
  for (const op of ops) {
    if (op.kind === "text") {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.fillText(op.text, op.x, op.y);
      continue;
    }
    // Map with pins.
    ctx.drawImage(mapImg, op.x, op.y, op.w, op.h);
    ctx.strokeStyle = "#e3e8ec";
    ctx.lineWidth = 1;
    ctx.strokeRect(op.x, op.y, op.w, op.h);
    for (const p of op.pins) {
      const px = op.x + p.fx * op.w;
      const py = op.y + p.fy * op.h;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#33485a";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.beginPath();               // thin dark outer ring for contrast on the busy map
      ctx.arc(px, py, 10.2, 0, Math.PI * 2);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "#1f2937";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = font(11, 700);
      ctx.textAlign = "center";
      ctx.fillText(String(p.n), px, py + 3.8);
      // time chip: white with a dark border, so it reads on any part of the map
      ctx.font = font(10.5, 700);
      const tw = ctx.measureText(p.time).width + 7;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px - tw / 2, py + 11, tw, 14);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "#1f2937";
      ctx.strokeRect(px - tw / 2, py + 11, tw, 14);
      ctx.fillStyle = "#111111";
      ctx.fillText(p.time, px, py + 21.5);
      ctx.textAlign = "left";
    }
  }
  return canvas.toDataURL("image/png");
}
