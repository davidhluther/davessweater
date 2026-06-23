"use client";
import { useEffect, useState } from "react";
import { sweaterFromEffective, effectiveTemp } from "@/lib/sweater";
import Outlook, { type OutlookDay } from "@/components/Outlook";

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
  const [outlook, setOutlook] = useState<OutlookDay[]>([]);

  useEffect(() => {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=36.2168&longitude=-81.6746"
      + "&current=temperature_2m"
      + "&daily=temperature_2m_max&forecast_days=5&temperature_unit=fahrenheit&timezone=America/New_York";
    fetch(url).then((r) => r.json()).then((d) => {
      const cur = d?.current?.temperature_2m;
      if (cur == null) return;
      const high = d?.daily?.temperature_2m_max?.[0] ?? cur;
      const v = sweaterFromEffective(effectiveTemp(high, cur));
      setS({ score: v.score, verdict: v.verdict, layers: v.layers,
        temp: `${Math.round(cur * 10) / 10}°F`, high: `High of ${Math.round(high)}°F today` });
      const maxes: number[] = d?.daily?.temperature_2m_max ?? [];
      const times: string[] = d?.daily?.time ?? [];
      const labels = times.map((t) => new Date(t + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }));
      setOutlook(maxes.slice(0, 5).map((hi, i) => ({ label: labels[i] ?? `D${i + 1}`, hi })));
    }).catch(() => {});
  }, []);

  return (
    <div className="text-center">
      <div className="mb-2 flex justify-center gap-1">{icons(s.score)}</div>
      <div className="text-4xl font-extrabold">{s.temp}{s.high ? <span className="ml-2 align-middle text-sm text-muted">now</span> : null}</div>
      {s.high ? <div className="text-sm text-muted">{s.high}</div> : null}
      <p className="mt-3 text-lg font-semibold">{s.verdict}</p>
      {s.layers ? <p className="mt-1 text-sm text-muted"><strong>Recommended layers:</strong> {s.layers}</p> : null}
      <Outlook days={outlook} />
    </div>
  );
}
