// Build-time share-card generator. Enumerates every card that used to be an
// `opengraph-image.tsx` route under a dynamic segment and renders it to a PNG
// under `public/og/`, using the SAME `brandOgCard` renderer and the SAME data
// loaders the pages use — so the cards are byte-for-byte what the routes
// produced, just without costing a Serverless Function each.
//
// Driven by `scripts/generate_og_images.mjs` (esbuild bundles this file so the
// `@/` alias and TSX resolve outside Next). See `src/lib/ogStatic.ts` for why
// these are files rather than routes.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { allTowns } from "@/lib/towns";
import { fmtPeakWindow, getLeafPredictions, leafBookends, leafByPeak } from "@/lib/leaf";
import { getBlogPosts, getReportCards, postSlug, postCategoryOf } from "@/lib/data";
import { CATEGORIES, POST_CATEGORIES } from "@/content/resources";
import { fmtLongDate } from "@/lib/dates";
import { brandOgCard } from "@/lib/ogCard";
import { ogPath } from "@/lib/ogStatic";

interface Card {
  /** Public path, e.g. "/og/weather/vilas.png" — also the file location under public/. */
  url: string;
  kicker: string;
  title: string;
  subtitle?: string;
  path: string;
  footer?: string;
}

/** Every card the site needs, mirroring the retired routes exactly. */
async function collectCards(): Promise<Card[]> {
  const cards: Card[] = [];

  // Boone keeps `/` and the root tracker board, so it has no town twin — same
  // filter the two page.tsx files apply.
  const towns = (await allTowns()).filter((t) => t.slug !== "boone");
  for (const town of towns) {
    cards.push({
      url: ogPath.weather(town.slug),
      kicker: "WEATHER",
      title: `${town.name}, NC weather`,
      subtitle: `Every source, one consensus, graded against ${town.name}'s own actuals.`,
      path: `/weather/${town.slug}`,
    });
    cards.push({
      url: ogPath.tracker(town.slug),
      kicker: "RIGHT RAY / WRONG RAY",
      title: `Who gets ${town.name}'s weather right?`,
      subtitle: `Every ${town.name} forecast, graded daily against what actually happened.`,
      path: `/right-wrong-ray/${town.slug}`,
    });
  }

  // The /leaf hub. A static route, so it could carry an opengraph-image.tsx
  // without costing a function -- but the card is built from the same committed
  // data as the page and there is no reason to render it per request, so it
  // lives here with the rest. Subtitle names the season's two bookends, which is
  // the whole story in one line.
  const leaf = await getLeafPredictions();
  const leafBounds = leafBookends(leafByPeak(leaf?.predictions ?? []));
  if (leaf && leafBounds) {
    const { first, last } = leafBounds;
    cards.push({
      url: ogPath.leaf,
      kicker: "FALL COLOR",
      title: "When the leaves peak in the High Country",
      subtitle: `${first.name} ${fmtPeakWindow(first.peak_start, first.peak_end)}, ${last.name} ${fmtPeakWindow(last.peak_start, last.peak_end)}. ${leaf.predictions.length} towns, graded in October.`,
      path: "/leaf",
    });
  }

  for (const category of POST_CATEGORIES) {
    const def = CATEGORIES.find((c) => c.key === category);
    cards.push({
      url: ogPath.resourceCategory(category),
      kicker: "RESOURCES",
      title: def?.label ?? "Resources",
      subtitle: def?.description,
      path: def?.href ?? "/resources",
    });
  }

  for (const post of await getBlogPosts()) {
    const category = postCategoryOf(post);
    const slug = postSlug(post);
    const def = CATEGORIES.find((c) => c.key === category);
    cards.push({
      url: ogPath.post(category, slug),
      kicker: (def?.label ?? "Resources").toUpperCase(),
      title: post.title ?? "Dave's Sweater",
      subtitle: post.summary,
      path: `/resources/${category}/${slug}`,
      footer: post.date ? `Published ${fmtLongDate(post.date)} | Boone, NC` : "Boone, NC",
    });
  }

  for (const card of await getReportCards()) {
    cards.push({
      url: ogPath.reportCard(card.reportMonth),
      kicker: "RAY'S WEATHER REPORT CARD",
      title: card.title ?? "Ray's Weather Report Card",
      subtitle: card.summary,
      path: `/report-card/${card.reportMonth}`,
      footer: card.date ? `Published ${fmtLongDate(card.date)} | Boone, NC` : "Boone, NC",
    });
  }

  return cards;
}

export async function main(): Promise<number> {
  const cards = await collectCards();
  const publicDir = join(process.cwd(), "public");

  for (const { url, ...card } of cards) {
    const response = await brandOgCard(card);
    const buffer = Buffer.from(await response.arrayBuffer());
    const dest = join(publicDir, url);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }

  return cards.length;
}
