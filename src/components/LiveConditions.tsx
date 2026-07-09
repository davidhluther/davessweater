"use client";
import { useEffect, useState } from "react";
import { sweaterFromEffective, effectiveTemp } from "@/lib/sweater";

function icons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt=""
      className={i < score ? "inline h-10 w-10 sm:h-11 sm:w-11" : "inline h-10 w-10 opacity-25 grayscale sm:h-11 sm:w-11"} />
  ));
}

// The page states ONE number for today's high: the Dave's Sweater Index
// consensus (passed in as `consensusHigh`), the same figure printed above in
// the Today module. The live Open-Meteo fetch still drives the current
// temperature and the sweater verdict, but it no longer gets to disagree with
// the index about today's high.
export default function LiveConditions({
  initialScore, initialVerdict, initialLayers, initialTemp, consensusHigh,
}: { initialScore: number; initialVerdict: string; initialLayers: string; initialTemp: string; consensusHigh?: number | null }) {
  const [s, setS] = useState({ score: initialScore, verdict: initialVerdict, layers: initialLayers, temp: initialTemp, high: "" });

  useEffect(() => {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=36.2168&longitude=-81.6746"
      + "&current=temperature_2m"
      + "&daily=temperature_2m_max&forecast_days=1&temperature_unit=fahrenheit&timezone=America/New_York";
    fetch(url).then((r) => r.json()).then((d) => {
      const cur = d?.current?.temperature_2m;
      if (cur == null) return;
      const high = d?.daily?.temperature_2m_max?.[0] ?? cur;
      const v = sweaterFromEffective(effectiveTemp(high, cur));
      setS({ score: v.score, verdict: v.verdict, layers: v.layers,
        temp: `${Math.round(cur * 10) / 10}°F`, high: `High of ${Math.round(high)}°F today` });
    }).catch(() => {});
  }, []);

  const highLine = consensusHigh != null ? `High of ${consensusHigh}°F today` : s.high;

  return (
    <div className="text-center">
      <div className="mb-2 flex justify-center gap-1" role="img" aria-label={`${s.score} of 5 sweaters`}>{icons(s.score)}</div>
      <div className="font-display text-4xl font-extrabold">{s.temp}{s.high ? <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">now</span> : null}</div>
      {highLine ? <div className="mt-0.5 text-xs text-muted">{highLine}</div> : null}
      <p className="mt-2.5 text-lg font-semibold">{s.verdict}</p>
      {s.layers ? <p className="mt-0.5 text-sm text-muted"><strong>Recommended layers:</strong> {s.layers}</p> : null}
    </div>
  );
}
