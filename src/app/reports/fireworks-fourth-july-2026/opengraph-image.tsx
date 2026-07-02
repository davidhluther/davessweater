import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SEASON } from "@/lib/fireworks";
import { NY_TZ, fmtTime, solarPacket } from "@/lib/solar";

export const alt =
  "Fourth of July fireworks in Boone and the High Country: exact computed start times from Dave's Sweater.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BOONE = { lat: 36.2168, lon: -81.6746 };

// Our computed start window — keep in sync with readWindow() in
// src/app/fireworks/page.tsx (civil-dusk end floored to :05, plus 15 minutes).
function readWindow(civilEnd: Date | null): string {
  if (!civilEnd) return "after dusk";
  const start = new Date(Math.floor(civilEnd.getTime() / 300_000) * 300_000);
  const end = new Date(start.getTime() + 15 * 60_000);
  return `${fmtTime(start, NY_TZ)}–${fmtTime(end, NY_TZ)}`;
}

// The fireworks share card: the page's whole argument on one image — "at
// dusk" is not a time, here are the computed ones. Dusk math is baked at
// build time from the same lib/solar the page renders, so the card can never
// disagree with the page. Route-scoped so /fireworks shares stop inheriting
// the scoreboard card.
export default async function OgImage() {
  const font = await readFile(join(process.cwd(), "src/assets/space-grotesk-700.woff"));
  const p = solarPacket({ ...BOONE, date: `${SEASON.year}-07-04`, tz: NY_TZ });
  const chips = [
    { label: "Sunset", value: fmtTime(p.sunset, NY_TZ) ?? "—", color: "#ffffff", border: "rgba(148, 163, 184, 0.35)" },
    { label: "Dark enough", value: fmtTime(p.civilDuskEnd, NY_TZ) ?? "—", color: "#ffffff", border: "rgba(148, 163, 184, 0.35)" },
    { label: "First shells, our read", value: readWindow(p.civilDuskEnd), color: "#fdba74", border: "rgba(249, 115, 22, 0.6)" },
  ];
  // The hero volley, quoted: red, white, and blue blooms in the card's sky.
  const bursts = [
    { top: -150, right: -110, size: 430, rgb: "248, 113, 113" },
    { top: 40, right: 250, size: 260, rgb: "255, 255, 255" },
    { top: 170, right: -60, size: 320, rgb: "96, 165, 250" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "56px 64px",
          backgroundColor: "#26323d",
          backgroundImage: "radial-gradient(circle at 24px 24px, rgba(255, 255, 255, 0.05) 2px, transparent 2px)",
          backgroundSize: "48px 48px",
          fontFamily: "Space Grotesk",
          color: "#ffffff",
        }}
      >
        {bursts.map((b) => (
          <div
            key={b.rgb}
            style={{
              position: "absolute",
              top: b.top,
              right: b.right,
              width: b.size,
              height: b.size,
              background: `radial-gradient(circle closest-side, rgba(${b.rgb}, 0.9), rgba(${b.rgb}, 0.35) 30%, rgba(${b.rgb}, 0.12) 55%, rgba(0, 0, 0, 0) 75%)`,
            }}
          />
        ))}

        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "rgba(255, 255, 255, 0.75)" }}>
          <span>DAVE&apos;S SWEATER&nbsp;|&nbsp;</span>
          <span style={{ color: "#fdba74" }}>THE HIGH COUNTRY FIREWORKS PAGE</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 74, lineHeight: 1.08 }}>
          <span>{"“At dusk” is not a time."}</span>
          <span style={{ color: "#f97316" }}>These are.</span>
        </div>

        <div style={{ display: "flex", marginTop: 48, gap: 24 }}>
          {chips.map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "18px 36px",
                borderRadius: 18,
                backgroundColor: "#2e4150",
                border: `2px solid ${c.border}`,
              }}
            >
              <span style={{ fontSize: 44, color: c.color }}>{c.value}</span>
              <span style={{ fontSize: 22, color: "rgba(255, 255, 255, 0.7)" }}>{c.label}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
          }}
        >
          <span>davessweater.com/reports/fireworks-fourth-july-2026</span>
          <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>
            July 4, {SEASON.year} | Boone, NC
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }],
    }
  );
}
