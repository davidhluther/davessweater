// Brand standard for dates (owner call, 2026-07-02): spell them out.
// Long form "June 30, 2026" everywhere a date appears in body copy; short
// form "Jun 30" only where space is genuinely tight (chart tooltips).
// Input is the pipeline's YYYY-MM-DD; the T12:00:00 anchor avoids the
// UTC-midnight off-by-one in local rendering.

export function fmtLongDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export function fmtShortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}
