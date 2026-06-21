import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PRED = join(process.cwd(), "data", "predictions");
const DEST = join(process.cwd(), "public", "screenshots");

function latestDir() {
  if (!existsSync(PRED)) return null;
  // Prediction dirs are named YYYY-MM-DD, so lexicographic sort == chronological.
  const dirs = readdirSync(PRED).filter((d) => statSync(join(PRED, d)).isDirectory()).sort();
  return dirs.length ? join(PRED, dirs[dirs.length - 1]) : null;
}

const src = latestDir();
if (!src) { console.log("[prepare_public] no predictions dir; skipping"); process.exit(0); }
mkdirSync(DEST, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (f.toLowerCase().endsWith(".png")) { copyFileSync(join(src, f), join(DEST, f)); n++; }
}
console.log(`[prepare_public] copied ${n} screenshot(s) from ${src}`);
if (n === 0) {
  console.warn(`[prepare_public] WARNING: ${src} has no .png files — /screenshots images may be missing`);
}
