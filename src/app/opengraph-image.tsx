import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getScores } from "@/lib/data";
import { whyStats } from "@/lib/homeStats";

export const alt =
  "Dave's Sweater, Boone's number one weather tracker. The free forecasts keep beating the one you pay for, tracked daily.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share card: the hero's argument with the live scoreboard numbers baked
// in at build time (the site rebuilds on every daily data commit, so the card
// stays current). Space Grotesk is vendored in src/assets because satori
// requires an embedded font and cannot read woff2.
export default async function OgImage() {
  const [font, scores] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/space-grotesk-700.woff")),
    getScores(),
  ]);
  const s = whyStats(scores);
  const chips = [
    { label: s.freeLabel, value: s.freeAvg.toFixed(1), color: "#6ee7b7", border: "rgba(110, 231, 183, 0.6)" },
    { label: "Ray's Weather", value: s.raysAvg.toFixed(1), color: "#cbd5e1", border: "rgba(148, 163, 184, 0.35)" },
    { label: "The gap", value: `${s.gap.toFixed(1)} pts`, color: "#ffffff", border: "rgba(249, 115, 22, 0.6)" },
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
        {/* the hero backdrop, quoted: sun in the corner, consensus glow at the base */}
        <div
          style={{
            position: "absolute",
            top: -280,
            right: -280,
            width: 660,
            height: 660,
            background:
              "radial-gradient(circle closest-side, rgba(255, 224, 166, 0.9), rgba(253, 186, 116, 0.5) 35%, rgba(249, 115, 22, 0.18) 62%, rgba(0, 0, 0, 0) 80%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -320,
            left: 180,
            width: 840,
            height: 500,
            background: "radial-gradient(circle closest-side, rgba(110, 231, 183, 0.26), rgba(0, 0, 0, 0) 75%)",
          }}
        />

        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "rgba(255, 255, 255, 0.75)" }}>
          <span>BOONE&apos;S #1 WEATHER&nbsp;</span>
          <span style={{ textDecoration: "line-through", color: "rgba(255, 255, 255, 0.55)" }}>SERVICE</span>
          <span style={{ color: "#fdba74" }}>&nbsp;TRACKER</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 76, lineHeight: 1.08 }}>
          <span>The free forecasts keep</span>
          <span style={{ display: "flex" }}>
            beating the one&nbsp;<span style={{ color: "#f97316" }}>you pay for.</span>
          </span>
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
          <span>davessweater.com</span>
          <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>{s.trackedDays} days on the record</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }],
    }
  );
}
