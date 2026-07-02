import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES } from "@/content/resources";

export const alt = "Dave's Sweater resources: articles, news, videos, and data reports on Boone mountain weather.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The resources hub share card: what lives here, in the site's own dot-grid
// teal. Category names come from the same CATEGORIES config the hub renders.
export default async function OgImage() {
  const font = await readFile(join(process.cwd(), "src/assets/space-grotesk-700.woff"));

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
          <span style={{ color: "#fdba74" }}>RESOURCES</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 70, lineHeight: 1.08 }}>
          <span>Mountain weather,</span>
          <span style={{ color: "#f97316" }}>graded and explained.</span>
        </div>

        <div style={{ display: "flex", marginTop: 48, gap: 20, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.href}
              style={{
                display: "flex",
                padding: "16px 32px",
                borderRadius: 18,
                backgroundColor: "#2e4150",
                border: "2px solid rgba(148, 163, 184, 0.35)",
                fontSize: 30,
              }}
            >
              {c.label}
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
          <span>davessweater.com/resources</span>
          <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>Boone, NC</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }],
    }
  );
}
