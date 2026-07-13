// ICS (RFC 5545) export for a selected itinerary. The timezone block is the
// classic failure point, so we ship an explicit VTIMEZONE for America/New_York
// (EDT −0400 in July) and reference it by TZID on every DTSTART/DTEND. The
// payoff is the VALARMs: a night-before shuttle heads-up (fare + cards-or-cash)
// and a morning leave-by reminder.

import type { GmhgEvent } from "@/lib/types";
import type { DayPlan } from "@/lib/gmhg/plan";
import { NY_TZ, zonedTimeToUtcMs } from "@/lib/solar";
import { SHUTTLE_PRICE_USD } from "@/lib/gmhg/constants";
import { DAY_LABEL, eventId, fmtClock, toMinutes } from "@/lib/gmhg/schedule";

const CRLF = "\r\n";
const PROID = "-//Dave's Sweater//GMHG Planner 2026//EN";

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYYMMDDTHHMMSS" local wall-clock (paired with TZID). */
function localStamp(day: string, min: number): string {
  return `${day.replace(/-/g, "")}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
}

/** "YYYYMMDDTHHMMSSZ" — a UTC instant. */
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** UTC stamp for a local wall-clock time on a day (DST-correct via solar). */
function localToUtcStamp(day: string, min: number): string {
  return utcStamp(new Date(zonedTimeToUtcMs(day, Math.floor(min / 60), min % 60, NY_TZ)));
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** RFC 5545 line folding: ≤75 octets, continuations start with a single space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join(CRLF);
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function endMinutes(e: GmhgEvent): number {
  const start = toMinutes(e.start);
  const end = e.end ? toMinutes(e.end) : start + 60;
  return Math.min(1439, Math.max(end, start + 1));
}

export interface IcsOptions {
  now?: Date;
  planByDay?: Record<string, DayPlan>;
}

/** The plan line embedded in the earliest event's DESCRIPTION for a day. */
function planLine(plan: DayPlan | undefined): string {
  if (!plan) return "";
  if (plan.concertOnly) {
    return "Concert night: drive up onto MacRae Meadows after 5 PM (gates 6 PM). No shuttle.";
  }
  const bits: string[] = [];
  if (plan.lot) bits.push(`Park at ${plan.lot}`);
  bits.push(`shuttle $${SHUTTLE_PRICE_USD}/seat round trip, cards or cash`);
  if (plan.leaveByMin != null && plan.leaveByMin >= 0) {
    bits.push(`suggested departure ${fmtClock(plan.leaveByMin)}`);
  }
  return bits.join(". ") + ".";
}

export function buildIcs(events: GmhgEvent[], opts: IcsOptions = {}): string {
  const now = opts.now ?? new Date();
  const dtstamp = utcStamp(now);
  const planByDay = opts.planByDay ?? {};

  const sorted = [...events].sort(
    (a, b) => a.day.localeCompare(b.day) || toMinutes(a.start) - toMinutes(b.start),
  );

  // Earliest selected event per day (the one that carries the plan + alarms).
  const earliestPerDay = new Map<string, string>();
  for (const e of sorted) {
    if (!earliestPerDay.has(e.day)) earliestPerDay.set(e.day, eventId(e));
  }
  const firstDay = sorted[0]?.day;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PROID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
  ];

  for (const e of sorted) {
    const id = eventId(e);
    const startMin = toMinutes(e.start);
    const endMin = endMinutes(e);
    const isEarliest = earliestPerDay.get(e.day) === id;
    const plan = planByDay[e.day];

    let description = `Venue: ${e.venue}.`;
    if (!e.end) description += " (End time estimated. Most items have no published end, so 60 min is assumed.)";
    if (e.notes) description += ` ${e.notes}`;
    if (isEarliest) {
      const pl = planLine(plan);
      if (pl) description += ` Getting there: ${pl}`;
    }

    lines.push(
      "BEGIN:VEVENT",
      `UID:${id}@davessweater.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=America/New_York:${localStamp(e.day, startMin)}`,
      `DTEND;TZID=America/New_York:${localStamp(e.day, endMin)}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(`MacRae Meadows – ${e.venue}, Grandfather Mountain, Linville NC`)}`,
      `DESCRIPTION:${esc(description)}`,
    );

    // Morning leave-by alarm on each day's earliest event.
    if (isEarliest && plan && !plan.concertOnly && plan.leaveByMin != null && plan.leaveByMin >= 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER;VALUE=DATE-TIME:${localToUtcStamp(e.day, plan.leaveByMin)}`,
        `DESCRIPTION:${esc(
          `Time to leave for the Games. Park at ${plan.lot ?? "your lot"} and shuttle up — cards or cash for the shuttle.`,
        )}`,
        "END:VALARM",
      );
    }

    // Night-before shuttle heads-up, once, on the very first event of the trip (6 PM prior day).
    if (isEarliest && e.day === firstDay) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER;VALUE=DATE-TIME:${localToUtcStamp(addDays(e.day, -1), 18 * 60)}`,
        `DESCRIPTION:${esc(
          `The Games are tomorrow. The shuttle runs $${SHUTTLE_PRICE_USD}/seat round trip — they take cards now, and cash still works.`,
        )}`,
        "END:VALARM",
      );
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join(CRLF) + CRLF;
}

/** Prefilled "Add to Google Calendar" URL for one event (single-event convenience). */
export function googleCalendarUrl(e: GmhgEvent): string {
  const startMin = toMinutes(e.start);
  const endMin = endMinutes(e);
  const dates = `${localStamp(e.day, startMin)}/${localStamp(e.day, endMin)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
    ctz: NY_TZ,
    details: `${DAY_LABEL[e.day] ?? e.day} at the Grandfather Mountain Highland Games. Venue: ${e.venue}.`,
    location: `MacRae Meadows – ${e.venue}, Grandfather Mountain, Linville NC`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
