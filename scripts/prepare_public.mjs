import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PRED = join(process.cwd(), "data", "predictions");
const DEST = join(process.cwd(), "public", "screenshots");

// Latest YYYY-MM-DD prediction dir that actually contains the iPhone screenshot the
// homepage needs. The regex guards against stray non-date entries (e.g. a malformed
// upload), and we fall back to the newest dir that HAS a screenshot so the Forecast
// card never goes missing on a day the latest capture lacks one.
function latestDirWithScreenshot() {
  if (!existsSync(PRED)) return null;
  const dirs = readdirSync(PRED)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && statSync(join(PRED, d)).isDirectory())
    .sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    if (existsSync(join(PRED, dirs[i], "iphone_screenshot.png"))) return join(PRED, dirs[i]);
  }
  return null;
}

const src = latestDirWithScreenshot();
if (!src) {
  console.log("[prepare_public] no prediction dir with iphone_screenshot.png; skipping");
  process.exit(0);
}
mkdirSync(DEST, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (!f.toLowerCase().endsWith(".png")) continue;
  if (f === "iphone_screenshot.png") {
    // The hero phone screenshot is shown ~150px wide, but the raw capture is
    // ~2.8MB / ~1200px — the site's Largest Contentful Paint (≈19s on throttled
    // mobile). Resize + convert to a small WebP so mobile isn't downloading a
    // full-res screenshot to paint a thumbnail. (The real-vs-fallback size
    // heuristic in src/lib/screenshot.ts reads the ORIGINAL in data/predictions,
    // so shrinking the public copy doesn't affect it.)
    await sharp(join(src, f))
      .resize({ width: 360, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toFile(join(DEST, "iphone_screenshot.webp"));
  } else {
    copyFileSync(join(src, f), join(DEST, f));
  }
  n++;
}
console.log(`[prepare_public] processed ${n} screenshot(s) from ${src}`);
