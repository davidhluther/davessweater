import Link from "next/link";
import {
  fmtPeakWindow, getLeafPredictions, leafBookends, leafByPeak, leafWindowIsCurrent,
} from "@/lib/leaf";

// The homepage's one seasonal line pointing at /leaf. Self-retiring: it renders
// only while at least one town's predicted window is still current, using the
// same grace period the town modules use, so last fall never sits on the
// homepage through the spring.
//
// `today` is injected in tests; in a build it is the build date, and the site
// rebuilds on every data commit, so the line disappears on its own.
export default async function LeafSeasonPrompt({ today = new Date() }: { today?: Date } = {}) {
  const data = await getLeafPredictions();
  const predictions = leafByPeak(data?.predictions ?? []);
  if (!predictions.some((p) => leafWindowIsCurrent(p, today))) return null;

  const bookends = leafBookends(predictions);
  if (!bookends) return null;
  const { first, last } = bookends;

  return (
    <p className="mx-auto mt-3 max-w-2xl text-center ds-body text-muted">
      Fall color runs on elevation here, so we forecast it that way:{" "}
      <Link href="/leaf" className="font-medium text-teal underline underline-offset-2">
        peak color windows for all {predictions.length} towns
      </Link>
      , {first.name} {fmtPeakWindow(first.peak_start, first.peak_end)} through {last.name}{" "}
      {fmtPeakWindow(last.peak_start, last.peak_end)}, graded in October like everything else.
    </p>
  );
}
