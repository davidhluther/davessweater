import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import {
  levelDisplay,
  conditionsAreFresh,
  type RoadsForecast,
  type RoadConditions,
  type RoadScores,
  type RoadDay,
} from "@/lib/roads";
import { MIN_SCORED_DAYS } from "@/lib/gating";

const TONE_TEXT = {
  good: "text-green-700",
  warn: "text-orange-600",
  bad: "text-red-700",
} as const;

function shortDay(date: string | undefined): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ForecastCard({ day, label }: { day: RoadDay; label: string }) {
  const tone = levelDisplay(day.level).tone;
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="ds-kicker text-muted">{label}</p>
      <p className={`mt-1 ds-stat ${TONE_TEXT[tone]}`}>{day.level}</p>
      <p className="mt-1 ds-body text-muted">{day.reason}</p>
    </div>
  );
}

export default function RoadConditionsBlock({
  forecast,
  conditions,
  scores,
  now = new Date(),
}: {
  forecast: RoadsForecast | null;
  conditions: RoadConditions | null;
  scores: RoadScores | null;
  now?: Date;
}) {
  const days = forecast?.days ?? [];
  const tomorrow = days[1] ?? days[0];
  const upcoming = days.slice(2, 5);
  const fresh = conditionsAreFresh(conditions, now);
  const closures = (conditions?.incidents ?? []).filter((i) => i.closed);
  const otherIncidents = (conditions?.incidents ?? []).filter((i) => !i.closed);
  const alerts = conditions?.parkway_alerts ?? [];

  return (
    <>
      <SectionBand tone="light">
        <h2 className="ds-h2">Tomorrow&apos;s road-condition forecast</h2>
        {tomorrow ? (
          <>
            <div className="mt-3">
              <ForecastCard day={tomorrow} label={shortDay(tomorrow.date)} />
            </div>
            {upcoming.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {upcoming.map((d) => {
                  const tone = levelDisplay(d.level).tone;
                  return (
                    <li key={d.date} className="rounded-md border border-border/60 bg-background px-3 py-2">
                      <span className="block text-xs text-muted">{shortDay(d.date)}</span>
                      <span className={`text-sm font-semibold ${TONE_TEXT[tone]}`}>{d.level}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 ds-caption">
              Our surface call from the snow, ice, and temperature we already forecast, then we{" "}
              <Link href="/methodology#roads" className="text-teal underline underline-offset-2">
                grade ourselves
              </Link>{" "}
              against what NCDOT reports.
            </p>
          </>
        ) : (
          <p className="mt-2 ds-body text-muted">No forecast available right now.</p>
        )}
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="ds-h2">
          Current conditions
          {fresh && conditions?.fetched_at && (
            <span className="ml-2 align-middle ds-caption font-normal">
              as of {new Date(conditions.fetched_at).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
        </h2>
        {!fresh ? (
          <p className="mt-2 ds-body text-muted">
            Live road data is temporarily unavailable. For real-time conditions, see{" "}
            <a
              href="https://drivenc.gov"
              rel="nofollow noopener"
              className="text-teal underline underline-offset-2"
            >
              DriveNC.gov
            </a>
            .
          </p>
        ) : (
          <>
            {closures.length === 0 && otherIncidents.length === 0 && alerts.length === 0 ? (
              <p className="mt-2 ds-body text-muted">
                No active closures, incidents, or Blue Ridge Parkway alerts reported for Watauga, Avery, or Ashe.
              </p>
            ) : (
              <div className="mt-2 space-y-4">
                {closures.length > 0 && (
                  <div>
                    <h3 className="ds-h4 text-red-700">Road closures</h3>
                    <ul className="mt-1 space-y-1 ds-body text-muted">
                      {closures.map((i, k) => (
                        <li key={`c${k}`}>
                          <span className="font-medium text-foreground">{i.road ?? "Road"}</span>
                          {i.county ? ` (${i.county})` : ""} &mdash; {i.description ?? i.type}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {alerts.length > 0 && (
                  <div>
                    <h3 className="ds-h4 text-foreground">Blue Ridge Parkway</h3>
                    <ul className="mt-1 space-y-1 ds-body text-muted">
                      {alerts.map((a, k) => (
                        <li key={`p${k}`}>
                          <span className="font-medium text-foreground">{a.title ?? "Alert"}</span>
                          {a.category ? ` (${a.category})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {otherIncidents.length > 0 && (
                  <div>
                    <h3 className="ds-h4 text-foreground">
                      Roadwork &amp; incidents ({otherIncidents.length})
                    </h3>
                    <ul className="mt-1 space-y-1 ds-body text-muted">
                      {otherIncidents.slice(0, 8).map((i, k) => (
                        <li key={`i${k}`}>
                          <span className="font-medium text-foreground">{i.road ?? "Road"}</span>
                          {i.county ? ` (${i.county})` : ""} &mdash; {i.description ?? i.type}
                        </li>
                      ))}
                    </ul>
                    {otherIncidents.length > 8 && (
                      <p className="mt-1 ds-caption">
                        &hellip;and {otherIncidents.length - 8} more. Full list at DriveNC.gov.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="mt-3 ds-caption">
              Source: NCDOT{" "}
              <a
                href="https://drivenc.gov"
                rel="nofollow noopener"
                className="text-teal underline underline-offset-2"
              >
                DriveNC.gov
              </a>{" "}
              (Division 11) and the National Park Service. Scoped to Watauga, Avery, and Ashe counties.
            </p>
          </>
        )}
      </SectionBand>

      {scores && scores.days.length > 0 && (
        <SectionBand tone="light">
          <h2 className="ds-h2">How our road forecast is scoring</h2>
          {scores.average != null ? (
            <p className="mt-1 ds-body text-muted">
              Average accuracy so far:{" "}
              <strong className="text-foreground">{scores.average}/100</strong> over {scores.days.length} scored{" "}
              {scores.days.length === 1 ? "day" : "days"}.
              {scores.days.length < MIN_SCORED_DAYS && " Still gathering data. A thin early sample, not a record yet."}
            </p>
          ) : null}
        </SectionBand>
      )}
    </>
  );
}
