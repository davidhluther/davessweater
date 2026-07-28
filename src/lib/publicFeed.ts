// Pure formatting + validation for the public data surface (JSON API, RSS
// feeds, embeddable widget). No filesystem access lives here — the town-aware
// loaders are in @/lib/towns — so every function below is unit-testable in
// isolation. The one honesty rule (a town is only exposed past the same
// MIN_SCORED_DAYS gate the site uses) is enforced in @/lib/towns; this module
// just shapes what a gated town returns.

import type { StripDay } from "@/lib/forecast5";
import { fmtLongDate } from "@/lib/dates";

// ── License / attribution (CC BY 4.0 — owner decision 2026-07-25) ──────────
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const LICENSE_NAME = "CC BY 4.0";
export const ATTRIBUTION = "Data by Dave's Sweater, CC BY 4.0";
export const SITE_BASE = "https://davessweater.com";

/** Ready-to-paste attribution markup. CC BY requires credit with a link to the
 *  source, so we hand reusers the exact anchor we want back (owner, 2026-07-27:
 *  the attribution should carry a "Dave's Sweater" backlink). Reusers who paste
 *  this satisfy the license and link the brand name in one step. */
export const ATTRIBUTION_HTML =
  `Data by <a href="${SITE_BASE}">Dave's Sweater</a>, ` +
  `licensed under <a href="${LICENSE_URL}">CC BY 4.0</a>`;

/** Every JSON API response carries these fields (owner requirement). */
export const LICENSE_FIELDS = {
  license: LICENSE_URL,
  attribution: ATTRIBUTION,
  attribution_html: ATTRIBUTION_HTML,
  source: SITE_BASE,
} as const;

// ── Display-option validation (days = 1|3|5 default 3; detail default summary)
export const VALID_DAYS = [1, 3, 5] as const;
export type Days = (typeof VALID_DAYS)[number];
export const DEFAULT_DAYS: Days = 3;

export const VALID_DETAIL = ["summary", "full"] as const;
export type Detail = (typeof VALID_DETAIL)[number];
export const DEFAULT_DETAIL: Detail = "summary";

export type ParamResult<T> = { ok: true; value: T } | { ok: false; error: string };

// Missing param → documented default (friendly public API); a present-but-bad
// value → a 400-worthy error string that names the valid options (self-
// documenting, per the spec's error contract).
export function parseDays(raw: string | null): ParamResult<Days> {
  if (raw == null || raw === "") return { ok: true, value: DEFAULT_DAYS };
  const n = Number(raw);
  if ((VALID_DAYS as readonly number[]).includes(n)) return { ok: true, value: n as Days };
  return { ok: false, error: `days must be one of 1, 3, 5 (default 3); got "${raw}"` };
}

export function parseDetail(raw: string | null): ParamResult<Detail> {
  if (raw == null || raw === "") return { ok: true, value: DEFAULT_DETAIL };
  if ((VALID_DETAIL as readonly string[]).includes(raw)) return { ok: true, value: raw as Detail };
  return { ok: false, error: `detail must be one of summary, full (default summary); got "${raw}"` };
}

// ── Sweater phrasing (short label from the 0–5 count the site already computes)
// Kept in sync with the sweater bands in CLAUDE.md / src/lib/sweater.ts; this is
// the compact public label, not the site's full wry verdict.
export function sweaterShort(count: number): string {
  if (count >= 5) return "Serious sweater weather";
  if (count >= 3) return "Sweater weather";
  if (count === 2) return "Maybe a sweater";
  return "No sweater";
}

const precipWord = (precip: string): string =>
  precip === "snow" ? "snow" : precip === "mixed" ? "wintry mix" : "rain";

/**
 * One compact, human, single-line summary of a day, brand pipe-separated:
 *   "High 74 | Low 55 | 40% rain | 2 sweaters"
 * Precip segment shows the consensus chance when a source publishes one, else
 * the precip label; a dry day reads "No precip". Sweater count pluralizes.
 */
export function forecastLine(day: StripDay): string {
  const parts = [`High ${day.high}`, `Low ${day.low}`];
  if (day.precip === "none") {
    parts.push("No precip");
  } else if (typeof day.precipProb === "number") {
    parts.push(`${day.precipProb}% ${precipWord(day.precip)}`);
  } else {
    parts.push(day.precipLabel);
  }
  const n = day.sweaters;
  parts.push(`${n} ${n === 1 ? "sweater" : "sweaters"}`);
  return parts.join(" | ");
}

// ── JSON API day shapes ────────────────────────────────────────────────────
export interface ApiForecastDay {
  date: string;
  /** Brand long form, e.g. "July 25, 2026". */
  date_label: string;
  high_f: number;
  low_f: number;
  precip_type: string;
  /** Consensus precip chance (%), when any contributing source publishes one. */
  precip_chance: number | null;
  sweaters: number;
  sweater_summary: string;
  /** The compact human line (same text the RSS items carry). */
  summary: string;
  /** How many forecasters fed the day's Dave's Sweater Index consensus. */
  dsi_sources: number;
  /** Present only with detail=full: the raw per-source rows behind the consensus. */
  sources?: Record<string, ApiSourceRow>;
}

export interface ApiSourceRow {
  label: string;
  high_f: number | null;
  low_f: number | null;
  wind: string | null;
  precip_type: string | null;
  precip_chance?: number | null;
}

/** Build a summary API day from the site's own StripDay consensus. */
export function toApiDay(day: StripDay): ApiForecastDay {
  return {
    date: day.date,
    date_label: fmtLongDate(day.date),
    high_f: day.high,
    low_f: day.low,
    precip_type: day.precip,
    precip_chance: typeof day.precipProb === "number" ? day.precipProb : null,
    sweaters: day.sweaters,
    sweater_summary: sweaterShort(day.sweaters),
    summary: forecastLine(day),
    dsi_sources: day.count,
  };
}

// ── RSS 2.0 ────────────────────────────────────────────────────────────────
export function rssEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  /** RFC-822 date; a Date is converted, a string is passed through. */
  pubDate?: Date | string;
  description: string;
}

export interface RssChannel {
  title: string;
  link: string;
  description: string;
  /** Absolute URL of this feed itself (atom:link rel=self). */
  selfUrl: string;
  items: RssItem[];
  lastBuildDate?: Date;
}

const rfc822 = (d: Date | string): string => (typeof d === "string" ? d : d.toUTCString());

/** Serialize a valid RSS 2.0 document (well-formed XML, atom self-link). */
export function buildRss(ch: RssChannel): string {
  const items = ch.items
    .map((it) => {
      const lines = [
        `    <item>`,
        `      <title>${rssEscape(it.title)}</title>`,
        `      <link>${rssEscape(it.link)}</link>`,
        `      <guid isPermaLink="false">${rssEscape(it.guid)}</guid>`,
      ];
      if (it.pubDate) lines.push(`      <pubDate>${rssEscape(rfc822(it.pubDate))}</pubDate>`);
      lines.push(`      <description>${rssEscape(it.description)}</description>`);
      lines.push(`    </item>`);
      return lines.join("\n");
    })
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${rssEscape(ch.title)}</title>`,
    `    <link>${rssEscape(ch.link)}</link>`,
    `    <description>${rssEscape(ch.description)}</description>`,
    `    <language>en-us</language>`,
    `    <atom:link href="${rssEscape(ch.selfUrl)}" rel="self" type="application/rss+xml" />`,
    `    <generator>Dave's Sweater</generator>`,
    ch.lastBuildDate ? `    <lastBuildDate>${rssEscape(ch.lastBuildDate.toUTCString())}</lastBuildDate>` : ``,
    items,
    `  </channel>`,
    `</rss>`,
    ``,
  ]
    .filter((l) => l !== ``)
    .join("\n");
}
