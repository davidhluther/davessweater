import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared next/og share card for routes without a bespoke data card — same
// dark-teal dot-grid dialect as the homepage / right-wrong-ray / reports
// cards, so every share renders on-brand instead of imageless.
export const OG_SIZE = { width: 1200, height: 630 };

export async function brandOgCard({
  kicker,
  title,
  subtitle,
  path,
  footer = "Scored daily | Boone, NC",
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  path: string;
  footer?: string;
}) {
  const font = await readFile(join(process.cwd(), "src/assets/space-grotesk-700.woff"));
  const titleSize = title.length > 70 ? 46 : title.length > 45 ? 54 : 64;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          backgroundColor: "#26323d",
          backgroundImage:
            "radial-gradient(circle at 24px 24px, rgba(255, 255, 255, 0.05) 2px, transparent 2px)",
          backgroundSize: "48px 48px",
          fontFamily: "Space Grotesk",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "rgba(255, 255, 255, 0.75)" }}>
          <span>DAVE&apos;S SWEATER&nbsp;|&nbsp;</span>
          <span style={{ color: "#fdba74" }}>{kicker}</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: titleSize,
            lineHeight: 1.12,
            maxWidth: 1040,
          }}
        >
          <span>{title}</span>
        </div>

        {subtitle ? (
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 30,
              lineHeight: 1.35,
              maxWidth: 980,
              color: "rgba(255, 255, 255, 0.72)",
            }}
          >
            <span>{subtitle}</span>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
          }}
        >
          {/* Long post paths wrap into the right footer — domain only past ~40 chars */}
          <span>davessweater.com{path.length > 40 ? "" : path}</span>
          <span style={{ color: "rgba(255, 255, 255, 0.65)" }}>{footer}</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }] }
  );
}
