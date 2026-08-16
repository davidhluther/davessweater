import { notFound } from "next/navigation";
import Link from "next/link";
import { getReportCards, getReportCard } from "@/lib/data";
import { fmtLongDate } from "@/lib/dates";
import { ogAlt, ogImage, ogPath } from "@/lib/ogStatic";
import { SITE_BASE, breadcrumbs, faqPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import PostBody from "@/components/PostBody";
import JsonLd from "@/components/JsonLd";

// The permanent home for the monthly Ray's Weather Report Card. Each card is a
// native post carrying `category: report-card` + `reportMonth: YYYY-MM`; the
// month is the URL segment, so a new card lands here the moment its .md file
// appears — no per-month code. Rendering reuses the shared native-post path
// (getReportCards → PostBody), the same one the Articles route uses.
export const dynamicParams = false;

export async function generateStaticParams() {
  const cards = await getReportCards();
  return cards.map((c) => ({ month: c.reportMonth }));
}

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const card = await getReportCard(month);
  if (!card) return { title: "Report Card" };
  // Prerendered share card (public/og/...), not an opengraph-image route: a
  // dynamic-segment image route costs a Serverless Function against the Vercel
  // Hobby cap of 12. See src/lib/ogStatic.ts.
  const ogCard = ogImage(ogPath.reportCard(month), ogAlt.reportCard);
  const title = card.metaTitle ?? card.title;
  const description = card.metaDescription ?? card.summary;
  const url = `/report-card/${month}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url: `${SITE_BASE}${url}`, images: [ogCard] },
  };
}

export default async function Page({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const card = await getReportCard(month);
  if (!card) notFound();
  const url = `/report-card/${month}`;
  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Report Card", path: "/report-card" },
      { name: card.title, path: url },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: card.title,
      url: `${SITE_BASE}${url}`,
      mainEntityOfPage: `${SITE_BASE}${url}`,
      image: `${SITE_BASE}${ogPath.reportCard(month)}`,
      ...(card.date ? { datePublished: card.date } : {}),
      ...(card.summary ? { description: card.summary } : {}),
      author: { "@type": "Organization", name: "Dave's Sweater" },
      publisher: { "@type": "Organization", name: "Dave's Sweater", url: SITE_BASE },
    },
    ...(card.faqs && card.faqs.length ? [faqPage(card.faqs)] : []),
  ];
  return (
    <SectionBand>
      <JsonLd data={jsonLd} />
      <article>
        <Link href="/report-card" className="text-sm text-orange-600 hover:underline underline-offset-2">
          &larr; All report cards
        </Link>
        <h1 className="mt-3 ds-h1 text-foreground">{card.title}</h1>
        {card.date && <p className="mt-1 ds-body text-muted">Published {fmtLongDate(card.date)}</p>}
        <PostBody post={card} />
      </article>
    </SectionBand>
  );
}
