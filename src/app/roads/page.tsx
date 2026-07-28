import type { Metadata } from "next";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import RoadConditionsBlock from "@/components/RoadConditions";
import { getRoadsForecast, getLatestRoadConditions, getRoadScores } from "@/lib/roads";

export const metadata: Metadata = {
  title: "Boone road conditions & winter road forecast",
  description:
    "Will the roads be bad tomorrow morning? A scored winter road-condition forecast plus live closures, incidents, and Blue Ridge Parkway alerts for Boone and the NC High Country.",
  alternates: { canonical: "/roads" },
  openGraph: {
    title: "High Country road conditions & winter road forecast | Dave's Sweater",
    description:
      "A scored winter road-condition forecast plus live closures and Blue Ridge Parkway alerts for Boone, Watauga, Avery, and Ashe counties.",
    url: "https://davessweater.com/roads",
    type: "website",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "High Country road conditions & winter road forecast",
    "description":
      "A scored winter road-condition forecast plus live closures, incidents, and Blue Ridge Parkway alerts for Boone and the NC High Country.",
    "url": "https://davessweater.com/roads",
    "isAccessibleForFree": true,
    "publisher": { "@type": "Organization", "name": "Dave's Sweater", "url": "https://davessweater.com" },
    "mainEntityOfPage": "https://davessweater.com/roads",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://davessweater.com" },
      { "@type": "ListItem", "position": 2, "name": "Roads", "item": "https://davessweater.com/roads" },
    ],
  },
];

export default async function RoadsPage() {
  const [forecast, conditions, scores] = await Promise.all([
    getRoadsForecast(),
    getLatestRoadConditions(),
    getRoadScores(),
  ]);
  return (
    <>
      <JsonLd data={jsonLd} />
      <SectionBand tone="surface">
        <h1 className="ds-h1">High Country road conditions</h1>
        <p className="mt-2 max-w-2xl ds-body text-muted">
          Will the roads be bad tomorrow morning? We forecast the surface from the snow, ice, and temperature we
          already track &mdash; then check ourselves against what NCDOT actually reports. Live closures and Blue
          Ridge Parkway alerts, too, for Watauga, Avery, and Ashe.
        </p>
      </SectionBand>
      <RoadConditionsBlock forecast={forecast} conditions={conditions} scores={scores} />
    </>
  );
}
