"use client";
// The interactive core of the Highland Games planner. Pick events on a per-day
// timeline and see conflicts and walk feasibility live as you pick; below, your
// whole trip assembles as one consolidated plan that stacks Thursday to Sunday.
// The forecast is fetched client-side at MacRae's own coordinates. The save and
// print outputs are the same consolidated plan, so nothing is a surprise.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GmhgCluster, GmhgEvent, GmhgLogistics, GmhgMeta } from "@/lib/types";
import { transitionVerdict, type Transition, type TransitionStatus } from "@/lib/gmhg/walk";
import { buildDayPlan, shuttleCost, ORIGIN_LABELS, type DayPlan } from "@/lib/gmhg/plan";
import { packingFor, type DayForecast } from "@/lib/gmhg/packing";
import { buildIcs } from "@/lib/gmhg/ics";
import { planImageDataUrl } from "@/lib/gmhg/planImage";
import { MACRAE, ORIGINS, type OriginKey } from "@/lib/gmhg/constants";
import {
  DAY_LABEL, DAY_ORDER, DAY_SHORT, eventId, eventsForDay, fmtClock, fmtClockStr, toMinutes,
} from "@/lib/gmhg/schedule";
import FieldMap, { SHUTTLE_ACCESSIBLE_ZONE, SHUTTLE_LABEL, SHUTTLE_ZONE, type FieldPin } from "@/components/gmhg/FieldMap";
import HourlyRain, { type RainHour } from "@/components/gmhg/HourlyRain";

const CLUSTER_UI: Record<GmhgCluster, { bg: string; text: string }> = {
  center: { bg: "bg-teal-50", text: "text-teal" },
  north: { bg: "bg-indigo-50", text: "text-indigo-700" },
  south: { bg: "bg-violet-50", text: "text-violet-700" },
  offsite: { bg: "bg-slate-100", text: "text-slate-600" },
};

const STATUS_UI: Record<TransitionStatus, { label: string; cls: string }> = {
  ok: { label: "comfortable", cls: "bg-green-700 text-white" },
  covisible: { label: "watch both", cls: "bg-teal text-white" },
  tight: { label: "tight", cls: "bg-amber-600 text-white" },
  wontfit: { label: "won’t fit", cls: "bg-red-700 text-white" },
  overlap: { label: "same time", cls: "bg-red-700 text-white" },
  offsite: { label: "off the Meadow", cls: "bg-slate-200 text-slate-700" },
};

function clusterOf(e: GmhgEvent, meta: GmhgMeta): GmhgCluster {
  return e.zone ? (meta.zones[e.zone]?.cluster ?? "offsite") : "offsite";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const num = (n: number | null): string => (n == null ? "n/a" : String(Math.round(n)));

/** Last shuttle back for a day, read from the schedule string ("...-17:00"). */
function lastShuttle(day: string, logistics: GmhgLogistics): string | null {
  const h = logistics.shuttle_hours[day];
  const m = h?.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return fmtClock(Number(m[3]) * 60 + Number(m[4]));
}

/** One earnest line describing a transition (shown on hover). */
function transitionText(t: Transition): string {
  if (t.status === "covisible") return "Same time as your previous pick, but both sit at the field or bleachers area, so you can take in both at once.";
  if (t.status === "overlap") return "Same start time as your previous pick, so you can only be one place at once.";
  if (t.status === "offsite") return "Off-mountain hop. Not an on-field walk, so leave yourself travel time.";
  const walk = `About ${t.walkMin} min walk${t.peak ? " at peak crowds" : ""}`;
  const gap = `${t.gapMin} min between starts`;
  if (t.status === "wontfit") return `${walk}, only ${gap}. It will not fit cleanly.`;
  if (t.status === "tight") return `${walk}, ${gap}. Tight, so move promptly.`;
  return `${walk}, ${gap}. Comfortable.`;
}

/** Ordered map pins for a day's events, plus the shuttle drop-off as the final
 *  pin (skipped on concert-only drive-up days). */
function pointsForDay(evs: GmhgEvent[], concertOnly: boolean, accessible: boolean): FieldPin[] {
  const pins: FieldPin[] = evs.map((e, i) => ({ n: i + 1, zone: e.zone, venue: e.venue, time: fmtClockStr(e.start) }));
  if (!concertOnly) pins.push({ n: evs.length + 1, zone: accessible ? SHUTTLE_ACCESSIBLE_ZONE : SHUTTLE_ZONE, time: SHUTTLE_LABEL });
  return pins;
}

/** Which gate the shuttle drops at, given the accessibility choice. */
function shuttleGate(accessible: boolean): string {
  return accessible ? "Gate 3, accessible transport" : "Gate 1";
}

export default function Planner({ events, meta }: { events: GmhgEvent[]; meta: GmhgMeta }) {
  const [activeDay, setActiveDay] = useState<string>(DAY_ORDER[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState<OriginKey>("boone");
  const [partySize, setPartySize] = useState(2);
  const [accessible, setAccessible] = useState(false);
  const [filter, setFilter] = useState<string>("all"); // "all" | "highlights" | category
  const [forecast, setForecast] = useState<Record<string, DayForecast> | null>(null);
  const [hourly, setHourly] = useState<Record<string, RainHour[]>>({});
  const [fcStatus, setFcStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // Live forecast at MacRae's own coordinates (not Boone's), for the four days.
  useEffect(() => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${MACRAE.lat}&longitude=${MACRAE.lon}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max" +
      "&hourly=precipitation,precipitation_probability" +
      "&temperature_unit=fahrenheit&timezone=America/New_York&start_date=2026-07-09&end_date=2026-07-12";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const days: string[] = d?.daily?.time ?? [];
        if (!days.length) { setFcStatus("error"); return; }
        const out: Record<string, DayForecast> = {};
        days.forEach((date, i) => {
          out[date] = {
            date,
            tempMaxF: d.daily.temperature_2m_max?.[i] ?? null,
            tempMinF: d.daily.temperature_2m_min?.[i] ?? null,
            precipProbMaxPct: d.daily.precipitation_probability_max?.[i] ?? null,
            uvIndexMax: d.daily.uv_index_max?.[i] ?? null,
          };
        });
        const hrs: Record<string, RainHour[]> = {};
        const times: string[] = d?.hourly?.time ?? [];
        times.forEach((t, i) => {
          const date = t.slice(0, 10);
          const hour = Number(t.slice(11, 13));
          if (hour < 7 || hour > 22) return; // event window
          (hrs[date] ??= []).push({
            hour,
            prob: d.hourly.precipitation_probability?.[i] ?? 0,
            inches: d.hourly.precipitation?.[i] ?? 0,
          });
        });
        setForecast(out);
        setHourly(hrs);
        setFetchedAt(new Date());
        setFcStatus("ready");
      })
      .catch(() => setFcStatus("error"));
  }, []);

  // Deep links from the reports-page teaser: ?day=fri jumps to a day, and
  // ?start=highlights pre-selects the marquee events. Reading window.location in
  // an effect keeps the page statically prerendered (no useSearchParams); the
  // one-time param-driven setState on mount is exactly what this is for.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dayParam = (params.get("day") ?? "").toLowerCase();
    const d = DAY_ORDER.find((x) => DAY_SHORT[x].toLowerCase() === dayParam);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (d) setActiveDay(d);
    if (params.get("start") === "highlights") {
      setSelected(new Set(events.filter((e) => e.highlight && e.selectable).map(eventId)));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [events]);

  const checkedAt = useMemo(
    () => (fetchedAt
      ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(fetchedAt)
      : null),
    [fetchedAt],
  );

  const categories = useMemo(
    () => [...new Set(events.filter((e) => e.selectable).map((e) => e.category))].sort(),
    [events],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedEvents = useMemo(
    () => events.filter((e) => selected.has(eventId(e))),
    [events, selected],
  );

  const selectedForDay = useCallback(
    (day: string) =>
      selectedEvents
        .filter((e) => e.day === day)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.title.localeCompare(b.title)),
    [selectedEvents],
  );

  const badgeByToId = useMemo(() => {
    const m = new Map<string, Transition>();
    for (const day of DAY_ORDER) {
      const evs = selectedForDay(day);
      for (let i = 1; i < evs.length; i++) {
        const t = transitionVerdict(evs[i - 1], evs[i], meta.walk_times, meta.zones, {
          from: eventId(evs[i - 1]), to: eventId(evs[i]),
        });
        m.set(t.toId, t);
      }
    }
    return m;
  }, [selectedForDay, meta]);

  const dayPlans = useMemo(() => {
    const out: DayPlan[] = [];
    for (const day of DAY_ORDER) {
      const evs = selectedForDay(day);
      if (evs.length) out.push(buildDayPlan({ day, origin, accessible, events: evs }, meta.logistics));
    }
    return out;
  }, [selectedForDay, origin, accessible, meta]);

  const planByDay = useMemo(
    () => Object.fromEntries(dayPlans.map((p) => [p.day, p])) as Record<string, DayPlan>,
    [dayPlans],
  );
  const cost = useMemo(() => shuttleCost(dayPlans, partySize), [dayPlans, partySize]);
  const planDays = useMemo(() => DAY_ORDER.filter((d) => selectedForDay(d).length > 0), [selectedForDay]);

  const downloadIcs = () => {
    const ics = buildIcs(selectedEvents, { planByDay });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grandfather-highland-games-2026.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const makeImage = async () => {
    const url = await planImageDataUrl({
      events: selectedEvents, planByDay, cost, forecast, checkedAt, accessible,
      originLabel: ORIGIN_LABELS[origin], lastShuttleByDay: Object.fromEntries(DAY_ORDER.map((d) => [d, lastShuttle(d, meta.logistics)])),
    });
    setImgUrl(url);
  };

  const selectHighlights = () => {
    setSelected(new Set(events.filter((e) => e.highlight && e.selectable).map(eventId)));
  };

  const dayEvents = useMemo(() => {
    const evs = eventsForDay(events, activeDay);
    if (filter === "highlights") return evs.filter((e) => e.highlight);
    if (filter !== "all") return evs.filter((e) => e.category === filter);
    return evs;
  }, [events, activeDay, filter]);

  const slots = useMemo(() => {
    const m = new Map<string, GmhgEvent[]>();
    for (const e of dayEvents) {
      const arr = m.get(e.start) ?? [];
      arr.push(e);
      m.set(e.start, arr);
    }
    return [...m.entries()].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  }, [dayEvents]);

  const context = useMemo(
    () => events.filter((e) => e.day === activeDay && !e.selectable && e.category === "logistics"),
    [events, activeDay],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* How to use this */}
      <div className="print:hidden mb-5 rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-display font-bold text-foreground">How to use this</p>
        <ol className="mt-1.5 ml-4 list-decimal space-y-1 text-muted">
          <li>Filter by type if you like, then tap the events you want, one day at a time.</li>
          <li>Your picks assemble under <a href="#your-plan" className="font-medium text-teal underline underline-offset-2">Your plan</a> below, with an arrive-by time, a field map with your stops pinned, and an itinerary for each day.</li>
          <li>When it looks right, <a href="#save-print" className="font-medium text-teal underline underline-offset-2">save it as an image, add it to your calendar, or print it</a> so you have it offline at the field.</li>
        </ol>
      </div>

      {/* Controls */}
      <div className="print:hidden flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <label className="flex flex-col text-xs font-semibold text-muted">
          Coming from
          <select value={origin} onChange={(e) => setOrigin(e.target.value as OriginKey)}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            {ORIGINS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold text-muted">
          Party size
          <input type="number" min={1} max={20} value={partySize}
            onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="flex flex-col text-xs font-semibold text-muted">
          Filter by type
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            <option value="all">All events</option>
            <option value="highlights">Highlights only</option>
            {categories.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm font-medium text-foreground">
          <input type="checkbox" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} />
          Accessible transport
        </label>
        <div className="ml-auto flex gap-2 pb-0.5">
          <button onClick={selectHighlights}
            className="rounded-lg bg-teal px-3 py-1.5 text-sm font-bold text-white hover:bg-teal-800">
            Just the highlights
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground">
              Clear ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Day tabs (day selection) */}
      <div id="pick" className="print:hidden mt-5 scroll-mt-20 flex flex-wrap items-center gap-2" role="tablist" aria-label="Days">
        {DAY_ORDER.map((day) => {
          const n = selectedForDay(day).length;
          const active = day === activeDay;
          return (
            <button key={day} role="tab" aria-selected={active} onClick={() => setActiveDay(day)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-teal-700 text-white" : "border border-border bg-background text-muted hover:text-foreground"}`}>
              {DAY_SHORT[day]}
              {n > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-teal-50 text-teal"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      {/* Compact four-day forecast, under the day selection */}
      <div className="print:hidden mt-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="font-display text-sm font-bold">Weather at the field</h2>
          {checkedAt && <span className="text-[0.7rem] text-muted">Checked {checkedAt}</span>}
        </div>
        {fcStatus === "loading" && <p className="mt-1 text-xs text-muted">Checking the mountain forecast...</p>}
        {fcStatus === "error" && (
          <p className="mt-1 text-xs text-muted">Forecast unavailable right now. It runs cool, windy, and changeable up here, so pack layers and rain gear.</p>
        )}
        {forecast && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {DAY_ORDER.map((d) => {
              const fc = forecast[d];
              const act = d === activeDay;
              return (
                <button key={d} onClick={() => setActiveDay(d)}
                  className={`rounded-md border bg-background p-1.5 text-center ${act ? "border-teal ring-1 ring-teal/40" : "border-border"}`}>
                  <div className="text-[0.65rem] font-bold text-foreground">{DAY_SHORT[d]}</div>
                  {fc ? (
                    <>
                      <div className="text-xs font-semibold tabular-nums">{num(fc.tempMaxF)}°/{num(fc.tempMinF)}°</div>
                      <div className="text-[0.6rem] text-muted">Rain {num(fc.precipProbMaxPct)}%</div>
                    </>
                  ) : <div className="text-[0.6rem] text-muted">n/a</div>}
                </button>
              );
            })}
          </div>
        )}
        {(hourly[activeDay]?.length ?? 0) > 0 && (
          <div className="mt-2">
            <p className="text-[0.7rem] font-semibold text-foreground">Rain by hour, {DAY_LABEL[activeDay]} (taller bar = higher chance)</p>
            <HourlyRain hours={hourly[activeDay]} />
          </div>
        )}
        <p className="mt-1.5 text-[0.7rem] text-muted">Mountain forecasts change fast, so check again the morning you go.</p>
      </div>

      {/* Note above the schedule: co-visibility */}
      <div className="print:hidden mt-4 rounded-lg border border-border bg-teal-50 p-3 text-sm text-teal">
        Some events can be watched at the same time. Set your chairs on the grassy hillside or grab a spot in
        the bleachers and you can often catch a dance performance and a field event together, for instance. When
        two of your picks work that way, the planner marks them <strong>watch both</strong> instead of a clash.
      </div>

      {/* Timeline for the active day (picking) */}
      <div className="print:hidden mt-4">
        <h2 className="font-display text-xl font-bold">{DAY_LABEL[activeDay]}, July {Number(activeDay.slice(-2))}</h2>
        {context.length > 0 && (
          <p className="mt-1 text-xs text-muted">
            {context.map((c, i) => (
              <span key={eventId(c)}>{i > 0 && " | "}{fmtClockStr(c.start)} {c.title}</span>
            ))}
          </p>
        )}
        {slots.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No {filter !== "all" && filter !== "highlights" ? `${filter} ` : filter === "highlights" ? "highlight " : ""}events on this day.</p>
        ) : (
          <ol className="mt-3">
            {slots.map(([start, evs], si) => {
              const gap = si === 0 ? 0 : toMinutes(start) - toMinutes(slots[si - 1][0]);
              const mt = si === 0 ? 0 : Math.min(56, Math.max(10, gap * 0.5));
              return (
                <li key={start} className="flex gap-3" style={{ marginTop: mt }}>
                  <div className="w-16 shrink-0 pt-1 text-right text-xs font-semibold tabular-nums text-muted">
                    {fmtClockStr(start)}
                  </div>
                  <div className="flex flex-1 flex-wrap gap-2 border-l border-border pl-3">
                    {evs.map((e) => {
                      const id = eventId(e);
                      const cl = CLUSTER_UI[clusterOf(e, meta)];
                      const on = selected.has(id);
                      const badge = on ? badgeByToId.get(id) : undefined;
                      return (
                        <button key={id} onClick={() => toggle(id)} aria-pressed={on}
                          className={`min-w-[10rem] max-w-xs flex-1 rounded-lg border p-2.5 text-left transition ${e.highlight ? "border-l-4 border-l-orange-600" : ""} ${on ? "border-teal ring-2 ring-teal/40" : "border-border hover:border-teal/50"} ${cl.bg}`}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">{e.title}</span>
                            <span aria-hidden className={`mt-0.5 shrink-0 rounded px-1 text-[0.6rem] font-bold uppercase ${cl.text}`}>{cap(e.category)}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted">{e.venue}</div>
                          {badge && (
                            <div title={transitionText(badge)}
                              className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${STATUS_UI[badge.status].cls}`}>
                              {STATUS_UI[badge.status].label}
                              {badge.walkMin != null && ` | ~${badge.walkMin}m`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Consolidated plan: every selected day, stacked Thursday to Sunday */}
      <div id="your-plan" className="print:hidden mt-8 scroll-mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="font-display text-xl font-bold">Your plan</h2>
          {planDays.length > 0 && (
            <span className="flex flex-wrap gap-x-4 text-sm font-medium">
              <a href="#pick" className="text-teal underline underline-offset-2">↑ Add another day</a>
              <a href="#save-print" className="text-teal underline underline-offset-2">Jump to save &amp; print ↓</a>
            </span>
          )}
        </div>
        {planDays.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Pick events above and your trip assembles here: Arrive-by times, the right lot, walk warnings, a map, and a packing list for each day.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted">
              &ldquo;Leave by&rdquo; times start from <strong className="text-foreground">{ORIGIN_LABELS[origin]}</strong> and include the
              drive to the lot, the shuttle line, the ride up, and the walk to your first event.
            </p>
            <div className="mt-3 space-y-4">
              {planDays.map((day) => {
                const evs = selectedForDay(day);
                const plan = planByDay[day];
                const fc = forecast?.[day] ?? null;
                const last = lastShuttle(day, meta.logistics);
                const hasEarlyOrLate = evs.some((e) => { const m = toMinutes(e.start); return m < 9 * 60 || m >= 18 * 60; });
                const packing = packingFor(fc, hasEarlyOrLate);
                return (
                  <section key={day} className="rounded-xl border border-border bg-surface p-4">
                    <h3 className="font-display text-base font-bold">{DAY_LABEL[day]}, July {Number(day.slice(-2))}</h3>
                    {fc && (
                      <p className="mt-0.5 text-xs text-muted">Forecast: High {num(fc.tempMaxF)}° | Low {num(fc.tempMinF)}° | Rain {num(fc.precipProbMaxPct)}%{fc.uvIndexMax != null ? ` | UV ${num(fc.uvIndexMax)}` : ""}</p>
                    )}
                    {plan?.concertOnly ? (
                      <p className="mt-1 text-sm text-foreground"><strong>Concert night.</strong> Drive up onto MacRae Meadows after 5 PM (gates 6 PM). No shuttle, no lot.</p>
                    ) : plan && (
                      <p className="mt-1 text-sm text-muted">
                        {plan.leaveByMin != null && <>Leave {ORIGIN_LABELS[origin]} by <strong className="text-foreground tabular-nums">{fmtClock(plan.leaveByMin)}</strong> | </>}
                        {plan.lot && <>Park at <strong className="text-foreground">{plan.lot}</strong>{plan.alternateLots.length > 0 && <span className="text-muted"> (or {plan.alternateLots.join(", ")})</span>} | </>}
                        Shuttle $10/seat, cash only
                      </p>
                    )}
                    <div className="mt-2">
                      <ol className="space-y-1.5">
                        {evs.map((e, i) => {
                          const badge = badgeByToId.get(eventId(e));
                          return (
                            <li key={eventId(e)} className="text-sm">
                              <span className="tabular-nums text-muted">{fmtClockStr(e.start)}</span>{" "}
                              <span className="font-medium text-foreground">{i + 1}. {e.title}</span>
                              <span className="text-muted"> ({e.venue})</span>
                              {badge && (
                                <span title={transitionText(badge)}
                                  className={`ml-1 inline-block rounded px-1 align-middle text-[0.6rem] font-semibold ${STATUS_UI[badge.status].cls}`}>{STATUS_UI[badge.status].label}</span>
                              )}
                            </li>
                          );
                        })}
                        {!plan?.concertOnly && (
                          <li className="text-sm">
                            <span className="font-medium text-foreground">{evs.length + 1}. {SHUTTLE_LABEL}</span>
                            <span className="text-muted"> (drop-off and pickup at {shuttleGate(accessible)})</span>
                          </li>
                        )}
                      </ol>
                      <div className="mt-3">
                        <FieldMap pins={pointsForDay(evs, !!plan?.concertOnly, accessible)} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted"><strong className="text-foreground">Pack:</strong> {packing}</p>
                    {!plan?.concertOnly && last && (
                      <p className="mt-1.5 rounded bg-background px-2 py-1 text-xs font-semibold text-orange-600">
                        Last shuttle back leaves {last}. Do not get stranded on the mountain.
                      </p>
                    )}
                    <p className="mt-2 text-right">
                      <a href="#pick" className="text-xs font-medium text-teal underline underline-offset-2">↑ Back to top to add another day</a>
                    </p>
                  </section>
                );
              })}

              {cost.shuttleDays > 0 && (
                <div className="rounded-xl border border-orange-600/30 bg-background p-4">
                  <p className="text-sm"><strong className="text-orange-600">Bring ${cost.totalUsd} cash</strong> for shuttles.</p>
                  <p className="mt-0.5 text-xs text-muted">$10 × {partySize} {partySize === 1 ? "person" : "people"} × {cost.shuttleDays} {cost.shuttleDays === 1 ? "day" : "days"}. Cash only, no ATM on the mountain, so get it in town first.</p>
                </div>
              )}

              <div id="save-print" className="scroll-mt-20 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Save or print your plan</p>
                <button onClick={makeImage}
                  className="w-full rounded-lg bg-orange-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-[#9a3412]">
                  Save my plan as an image
                </button>
                <div className="flex gap-2">
                  <button onClick={downloadIcs}
                    className="flex-1 rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800">
                    Add to calendar
                  </button>
                  <button onClick={() => window.print()}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-teal">
                    Print
                  </button>
                </div>
              </div>

              {imgUrl && (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-semibold text-foreground">Your plan, ready to save</p>
                  <p className="mt-0.5 text-xs text-muted">Press and hold the image to save it to your phone, or right-click and choose Save image.</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl} alt="Your Highland Games plan" className="mt-2 w-full rounded border border-border" />
                  <div className="mt-2 flex items-center gap-3">
                    <a href={imgUrl} download="grandfather-highland-games-plan.png" className="text-xs font-medium text-teal underline">Download instead</a>
                    <button onClick={() => setImgUrl(null)} className="text-xs text-muted underline">Close</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PrintSheet events={selectedEvents} meta={meta} planByDay={planByDay} cost={cost} forecast={forecast} checkedAt={checkedAt} origin={origin} accessible={accessible} />
    </div>
  );
}

// ── Print one-pager (offline-first): hidden on screen, the whole plan on paper ──
function PrintSheet({
  events, meta, planByDay, cost, forecast, checkedAt, origin, accessible,
}: {
  events: GmhgEvent[];
  meta: GmhgMeta;
  planByDay: Record<string, DayPlan>;
  cost: { totalUsd: number; shuttleDays: number };
  forecast: Record<string, DayForecast> | null;
  checkedAt: string | null;
  origin: OriginKey;
  accessible: boolean;
}) {
  const days = DAY_ORDER.filter((d) => events.some((e) => e.day === d));
  if (events.length === 0) return null;
  return (
    <div className="gmhg-print hidden print:block">
      <h1 className="text-2xl font-bold">Your Grandfather Mountain Highland Games Plan, 2026</h1>
      {cost.shuttleDays > 0 && (
        <p className="mt-1 text-sm"><strong>Bring ${cost.totalUsd} cash</strong> for shuttles. $10/seat round trip, cash only, no ATM on site.</p>
      )}
      <p className="mt-1 text-xs">
        {checkedAt ? `Forecast checked ${checkedAt}. ` : ""}Mountain weather changes fast; check again the morning you go.
        &ldquo;Leave by&rdquo; times start from {ORIGIN_LABELS[origin]}.
      </p>
      {days.map((day) => {
        const evs = events.filter((e) => e.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        const plan = planByDay[day];
        const fc = forecast?.[day] ?? null;
        const last = lastShuttle(day, meta.logistics);
        const hasEarlyOrLate = evs.some((e) => { const m = toMinutes(e.start); return m < 9 * 60 || m >= 18 * 60; });
        const packing = packingFor(fc, hasEarlyOrLate);
        return (
          <section key={day} className="mt-4 break-inside-avoid">
            <h2 className="text-lg font-bold">{DAY_LABEL[day]}, July {Number(day.slice(-2))}</h2>
            {fc && <p className="text-xs">Forecast: High {num(fc.tempMaxF)}° | Low {num(fc.tempMinF)}° | Rain {num(fc.precipProbMaxPct)}%</p>}
            {plan?.concertOnly ? (
              <p className="text-sm">Concert night. Drive up onto MacRae Meadows after 5 PM (gates 6 PM). No shuttle.</p>
            ) : plan && (
              <p className="text-sm">
                {plan.leaveByMin != null && <>Leave {ORIGIN_LABELS[origin]} by <strong>{fmtClock(plan.leaveByMin)}</strong> | </>}
                {plan.lot && <>Park at <strong>{plan.lot}</strong>{plan.alternateLots.length > 0 && ` (or ${plan.alternateLots.join(", ")})`} | </>}
                Shuttle $10/seat, cash only.
              </p>
            )}
            <ul className="mt-1 text-sm">
              {evs.map((e, i) => (
                <li key={eventId(e)}>{i + 1}. {fmtClockStr(e.start)}, {e.title} ({e.venue})</li>
              ))}
              {!plan?.concertOnly && <li>{evs.length + 1}. {SHUTTLE_LABEL} (drop-off and pickup at {shuttleGate(accessible)})</li>}
            </ul>
            <div className="mt-1 w-[5in] max-w-full">
              <FieldMap pins={pointsForDay(evs, !!plan?.concertOnly, accessible)} />
            </div>
            <p className="mt-1 text-xs"><strong>Pack:</strong> {packing}</p>
            {!plan?.concertOnly && last && (
              <p className="text-xs font-semibold">Last shuttle back leaves {last}. Do not get stranded.</p>
            )}
          </section>
        );
      })}
      <p className="mt-4 text-xs">
        Games office (828) 733-1333. No pets on the Meadow (ADA service animals only).
        Accessible transport: Newland Elementary (Fri to Sun), Avery County HS (Thu).
        Plan is guidance; walk and drive times are estimates. Grandfather makes its own weather.
      </p>
    </div>
  );
}
