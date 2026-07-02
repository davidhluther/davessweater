import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getScores } from "@/lib/data";
import { heroStats } from "@/lib/homeStats";

export const alt =
  "Right Ray / Wrong Ray: daily forecast accuracy scores for Boone, NC from Dave's Sweater.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The scoreboard share card: the page's argument on one image — the free
// forecast vs the paid one, scored over the tracking window. Numbers are
// baked at build time from the same scores.json the page renders, so the
// card can never disagree with the scoreboard.
export default async function OgImage() {
  const font = await readFile(join(process.cwd(), "src/assets/space-grotesk-700.woff"));
  const stats = heroStats(await getScores());
  const free = stats.trackingBestFree;
  const rays = stats.trackingRays;
  const chips = [
    {
      label: `${free?.label ?? "Best free forecast"} (free)`,
      value: free ? free.avg.toFixed(1) : "—",
      color: "#ffffff",
      border: "rgba(29, 158, 117, 0.7)",
    },
    {
      label: "Ray's Weather (paid)",
      value: rays ? rays.avg.toFixed(1) : "—",
      color: "#fdba74",
      border: "rgba(249, 115, 22, 0.6)",
    },
    {
      label: "Days scored head-to-head",
      value: String(stats.trackingDays || "—"),
      color: "#ffffff",
      border: "rgba(148, 163, 184, 0.35)",
    },
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
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "rgba(255, 255, 255, 0.75)" }}>
          <span>DAVE&apos;S SWEATER&nbsp;|&nbsp;</span>
          <span style={{ color: "#fdba74" }}>RIGHT RAY / WRONG RAY</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 70, lineHeight: 1.08 }}>
          <span>The free forecasts keep beating</span>
          <span style={{ color: "#f97316" }}>the one you pay for.</span>
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
          <span>davessweater.com/right-wrong-ray</span>
          <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>Scored daily | Boone, NC</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }],
    }
  );
}
