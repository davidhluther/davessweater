// JSON-LD builders for the resources tree. Values render through the JsonLd
// component, which HTML-escapes text children — keep raw `<`, `>`, and `&` out
// of every string (write "and", not "&"; apostrophes are fine per the existing
// site schema).

export const SITE_BASE = "https://davessweater.com";

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_BASE}${it.path}`,
    })),
  };
}

export function collectionPage(opts: {
  name: string;
  path: string;
  description: string;
  parts?: { name: string; path: string; datePublished?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${SITE_BASE}${opts.path}`,
    isPartOf: { "@type": "WebSite", name: "Dave's Sweater", url: SITE_BASE },
    ...(opts.parts && opts.parts.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: opts.parts.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: p.name,
              url: p.path.startsWith("http") ? p.path : `${SITE_BASE}${p.path}`,
            })),
          },
        }
      : {}),
  };
}
