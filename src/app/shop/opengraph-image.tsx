import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Dave's Sweater swag shop — shirts, mugs, and Boone weather-tracker gear.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OgImage() {
  return brandOgCard({
    kicker: "SWAG SHOP",
    title: "The only thing around here with a price on it.",
    subtitle: "Shirts, mugs, and tracker gear at minimum price; the mandatory $3 profit goes to charity.",
    path: "/shop",
    footer: "Free site | Paid sweater",
  });
}
