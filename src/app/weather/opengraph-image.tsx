import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Weather by town — the High Country tracked and graded by Dave's Sweater.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage() {
  return brandOgCard({
    kicker: "WEATHER BY TOWN",
    title: "Each town, its own forecast — graded against its own actuals.",
    subtitle: "No regional write-up stamped across the map. Same rubric, town by town.",
    path: "/weather",
  });
}
