import { existsSync } from "node:fs";
import { join } from "node:path";

// Resolved at build time; prebuild (prepare_public.mjs) populates public/screenshots
// before next build, so this reflects whether a screenshot is available to serve.
const hasScreenshot = existsSync(
  join(process.cwd(), "public", "screenshots", "iphone_screenshot.png"),
);

export default function ForecastCard() {
  return (
    <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-1 text-2xl font-bold">Forecast</h2>
      <p className="mb-4 text-sm text-muted">Our meteorological experts predict the following forecast</p>
      {hasScreenshot ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/screenshots/iphone_screenshot.png" alt="Apple Weather forecast for Boone, NC"
            loading="lazy" className="max-w-xs rounded-xl" />
        </div>
      ) : (
        <p className="text-sm text-muted">Today&apos;s forecast screenshot isn&apos;t in yet — check back tomorrow.</p>
      )}
    </section>
  );
}
