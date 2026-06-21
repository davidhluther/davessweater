export default function ForecastCard() {
  return (
    <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-1 text-2xl font-bold">Forecast</h2>
      <p className="mb-4 text-sm text-muted">Our meteorological experts predict the following forecast</p>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/screenshots/iphone_screenshot.png" alt="Apple Weather forecast for Boone, NC"
          loading="lazy" className="max-w-xs rounded-xl" />
      </div>
    </section>
  );
}
