import Link from "next/link";
import { allTowns } from "@/lib/towns";

// A quiet wayfinding line directly under the hero: the homepage is Boone's, so a
// visitor from anywhere else needs to know their own town is tracked before they
// scroll past a full Boone forecast. One slim, crawlable line to the /weather hub
// (the long town list stays lower down in AlsoTracking). Renders nothing if Boone
// is the only tracked town.
export default async function TownWayfinder() {
  const others = (await allTowns()).filter((t) => t.slug !== "boone");
  if (!others.length) return null;
  return (
    <div className="border-b border-border bg-surface/70">
      <p className="mx-auto max-w-5xl px-4 py-2 text-center text-xs text-muted sm:text-sm">
        Not in Boone? Your town has its own page and scoreboard.{" "}
        <Link href="/weather" className="font-medium text-teal underline underline-offset-2">
          Find your town
        </Link>
      </p>
    </div>
  );
}
