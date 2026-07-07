import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Route-scoped share card so Highland Games shares stop inheriting the site
// scoreboard card. Text-forward and on-brand (dark teal + a torch-orange glow),
// selling the concrete deliverables the official schedule can't match.
export const alt =
  "Grandfather Mountain Highland Games 2026: a free interactive planner from Dave's Sweater. Filter events, get a printable per-day itinerary, a field map with your stops pinned, and arrive-by and walk times.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const font = await readFile(join(process.cwd(), "src/assets/space-grotesk-700.woff"));
  const chips = [
    "Filter the schedule",
    "Printable per-day itinerary",
    "Field map, your stops pinned",
    "Arrive-by + walk times",
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "64px 72px", background: "#26323d",
          color: "#ffffff", fontFamily: "Space Grotesk", position: "relative",
        }}
      >
        <div style={{
          position: "absolute", top: -190, right: -150, width: 640, height: 640, display: "flex",
          background: "radial-gradient(circle, rgba(249,115,22,0.55), rgba(249,115,22,0.14) 46%, rgba(38,50,61,0) 70%)",
        }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 2, color: "#fdba74", fontWeight: 700 }}>
            JULY 9–12, 2026  ·  MACRAE MEADOWS
          </div>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.05, marginTop: 18, maxWidth: 920 }}>
            Grandfather Mountain Highland Games 2026
          </div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#fdba74", marginTop: 10 }}>
            Plan Your Days
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {chips.map((c) => (
            <div key={c} style={{
              display: "flex", fontSize: 24, padding: "10px 20px", borderRadius: 999,
              border: "2px solid rgba(148,163,184,0.4)", background: "rgba(255,255,255,0.06)",
            }}>{c}</div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(255,255,255,0.7)" }}>
          <div style={{ display: "flex" }}>davessweater.com</div>
          <div style={{ display: "flex", color: "#fdba74", fontWeight: 700 }}>Free · no app, no sign-up</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }] },
  );
}
