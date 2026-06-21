import type { Comparison } from "@/lib/types";
import LiveConditions from "@/components/LiveConditions";

export default function SweaterCard({ comp }: { comp: Comparison | null }) {
  const sw = comp?.sweater_weather ?? {};
  const temp = comp?.actuals?.high_f != null ? `${comp.actuals.high_f}°F` : "—";
  return (
    <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-4 text-center text-2xl font-bold">Sweater weather in Boone?</h2>
      <LiveConditions
        initialScore={sw.sweater_count ?? 0}
        initialVerdict={sw.detail ?? sw.answer ?? ""}
        initialLayers={sw.layers ?? ""}
        initialTemp={temp}
      />
    </section>
  );
}
