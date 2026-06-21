"use client";
import { useEffect, useState } from "react";
import { sweaterFromEffective, effectiveTemp } from "@/lib/sweater";

function icons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt="sweater"
      className={i < score ? "inline h-9 w-9" : "inline h-9 w-9 opacity-25 grayscale"} />
  ));
}

export default function LiveConditions({
  initialScore, initialVerdict, initialLayers, initialTemp,
}: { initialScore: number; initialVerdict: string; initialLayers: string; initialTemp: string; }) {
  const [s, setS] = useState({ score: initialScore, verdict: initialVerdict, layers: initialLayers, temp: initialTemp, high: "" });

  useEffect(() => {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=36.2168&longitude=-81.6746"
      + "&current=temperature_2m,wind_speed_10m,relative_humidity_2m,apparent_temperature"
      + "&daily=temperature_2m_max&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York";
    fetch(url).then((r) => r.json()).then((d) => {
      const cur = d?.current?.temperature_2m;
      if (cur == null) return;
      const high = d?.daily?.temperature_2m_max?.[0] ?? cur;
      const v = sweaterFromEffective(effectiveTemp(high, cur));
      setS({ score: v.score, verdict: v.verdict, layers: v.layers,
        temp: `${Math.round(cur * 10) / 10}°F`, high: `High of ${Math.round(high)}°F today` });
    }).catch(() => {});
  }, []);

  return (
    <div className="text-center">
      <div className="mb-2 flex justify-center gap-1">{icons(s.score)}</div>
      <div className="text-4xl font-extrabold">{s.temp}{s.high ? <span className="ml-2 align-middle text-sm text-muted">now</span> : null}</div>
      {s.high ? <div className="text-sm text-muted">{s.high}</div> : null}
      <p className="mt-3 text-lg font-semibold">{s.verdict}</p>
      {s.layers ? <p className="mt-1 text-sm text-muted"><strong>Recommended layers:</strong> {s.layers}</p> : null}
    </div>
  );
}
