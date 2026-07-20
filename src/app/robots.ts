import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  // The content editor (/keystatic) + its API are private tooling, not content.
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/keystatic", "/api/keystatic"] },
    sitemap: "https://davessweater.com/sitemap.xml",
  };
}
