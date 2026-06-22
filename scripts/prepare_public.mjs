import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
  if (f.toLowerCase().endsWith(".png")) { copyFileSync(join(src, f), join(DEST, f)); n++; }
}
console.log(`[prepare_public] copied ${n} screenshot(s) from ${src}`);
