import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GmhgData, GmhgEvent } from "@/lib/types";

// Load the real committed dataset so the engine tests exercise the actual zone
// clusters, walk matrix, and logistics — not a hand-mocked copy that could drift.
export const DATA: GmhgData = JSON.parse(
  readFileSync(join(process.cwd(), "data", "gmhg_events.json"), "utf8"),
) as GmhgData;

export const ZONES = DATA.meta.zones;
export const WALK = DATA.meta.walk_times;
export const LOGISTICS = DATA.meta.logistics;

/** Minimal event builder for transition tests. */
export function ev(day: string, start: string, zone: string | null, extra: Partial<GmhgEvent> = {}): GmhgEvent {
  return {
    day, start, zone, title: extra.title ?? `${zone ?? "none"}@${start}`,
    venue: extra.venue ?? "Test", category: extra.category ?? "field", selectable: true, ...extra,
  };
}
