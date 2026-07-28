import { precipLabelFor, showsChance, type Composite } from "@/lib/composite";
import { copy } from "@/content/copy";

// The Dave's Sweater Index headline — the consensus of the free forecasters for
// the upcoming day. Rendered identically by the homepage (Boone) and by every
// town page, from one place so the two surfaces can't drift apart.
//
// The precip segment carries the consensus chance whenever any contributing
// forecaster publishes one, INCLUDING on dry days: "No precip | 8% chance" says
// something a bare "No precip" does not, and the number is the whole point of
// tracking several forecasters instead of one.
export default function CompositeHeadline({ composite: c }: { composite: Composite }) {
  const pipe = <span className="text-muted/60">|</span>;
  const chance = showsChance(c.precipProb);
  return (
    <div className="text-center">
      <div className="ds-kicker text-muted">
        {copy.index.title} | {c.dateLabel}
      </div>
      <div className="mt-1 ds-stat text-foreground">
        High {c.high}° {pipe} Low {c.low}° {pipe} {precipLabelFor(c.precip, chance)}
        {chance ? <> {pipe} {c.precipProb}% chance</> : null}
      </div>
      <div className="mt-1 ds-caption">
        {copy.index.footnote(c.count)}
        {chance && c.precipProbCount ? ` | ${copy.index.chanceFootnote(c.precipProbCount)}` : ""}
      </div>
      <div className="mt-1 ds-caption italic">{copy.index.tagline}</div>
    </div>
  );
}
