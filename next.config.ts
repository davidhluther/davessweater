import type { NextConfig } from "next";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Native posts living outside News need their legacy /blog/<slug> URL to land
// on the real category page — the blanket /blog/:slug rule below sends
// everything to /resources/news, which 404s for an Articles post. Scanned from
// the posts' own frontmatter at build time, so every future article is covered
// automatically (no manual list to forget).
function nativePostRedirects() {
  const out: { source: string; destination: string; permanent: boolean }[] = [];
  let files: string[] = [];
  const dir = join(process.cwd(), "src/content/posts");
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".mdoc"));
  } catch {
    return out;
  }
  for (const f of files) {
    const head = readFileSync(join(dir, f), "utf8").slice(0, 2000);
    const category = /^category:\s*["']?([\w-]+)/m.exec(head)?.[1] ?? "news";
    // CMS (.mdoc) posts store the slug as the filename, not a frontmatter key.
    const slug = /^slug:\s*["']?([\w-]+)/m.exec(head)?.[1] ?? f.replace(/\.(md|mdoc)$/, "");
    if (category === "report-card") {
      // Report cards live at /report-card/<yyyy-mm>, not under /resources. Emit
      // DIRECT single-hop redirects from both the /blog/<slug> legacy path and
      // the /resources/articles/<slug> URL the franchise's first card shipped
      // at — direct, so /blog never chains through the articles URL (itself a
      // redirect). No destination without a month, so skip if it's missing.
      const reportMonth = /^reportMonth:\s*["']?([\d-]+)/m.exec(head)?.[1];
      if (!reportMonth) continue;
      const dest = `/report-card/${reportMonth}`;
      out.push({ source: `/blog/${slug}`, destination: dest, permanent: true });
      out.push({ source: `/resources/articles/${slug}`, destination: dest, permanent: true });
    } else if (category !== "news") {
      out.push({ source: `/blog/${slug}`, destination: `/resources/${category}/${slug}`, permanent: true });
    }
  }
  return out;
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // getNativePosts() reads src/content/posts/*.{md,mdoc} off the filesystem.
  // Next's tracer only bundles files it can see statically, so any route that
  // renders in a Lambda rather than at build (e.g. a future revalidate window)
  // would otherwise get an empty reader. Ship the content with every function.
  //
  // The /api/v1/[...path] handlers and /widget are DYNAMIC (they read query
  // params, so they cannot be force-static) and read committed data/ JSON at
  // request time. The tracer can't see those runtime reads statically, so the
  // files must be declared here or the Lambda ships without them.
  //
  // ⚠️ KEEP THESE LISTS NARROW AND IDENTICAL. `./data/**/*.json` used to be the
  // whole list, which traced ~47 MB across 7,100 files (Turbopack warns that the
  // pattern "matches 19236 files") into every one of these Lambdas. Vercel packs
  // dynamic routes into the fewest functions it can, but it splits them apart as
  // the bundles grow — so the function count rose on its own as the daily
  // pipeline committed more JSON, with no code change, until it crossed the
  // Hobby cap of 12 and froze production for a week in August 2026. Two routes
  // with DIFFERENT include lists also cannot share a bundle, hence "identical".
  // Only add a path a Lambda genuinely reads at request time, and prefer a
  // specific file over a directory glob. See CHECKLIST.md for the budget.
  //
  // Deliberately NOT included: data/predictions/** (Boone's captures — read only
  // at build; ~12.5 MB of JSON beside 180 MB of screenshots), and the leaf/
  // leadtime/demand/traffic/actuals/events datasets, none of which these two
  // routes touch.
  outputFileTracingIncludes: {
    "/*": ["./src/content/**/*"],
    // towns.ts: registry, per-town scores/comparisons, and the latest per-town
    // capture that getTownForecast5 folds into a 5-day strip.
    // forecast5.ts + towns.ts: Boone's own forecast/scores/comparisons.
    // rivers.ts: the widget's river-flow readout.
    "/api/v1/[...path]": [
      "./data/locations/**/*.json",
      "./data/comparisons/*.json",
      "./data/rivers/*.json",
      "./data/forecast_5day.json",
      "./data/scores.json",
    ],
    "/widget": [
      "./data/locations/**/*.json",
      "./data/comparisons/*.json",
      "./data/rivers/*.json",
      "./data/forecast_5day.json",
      "./data/scores.json",
    ],
  },
  async headers() {
    // The embeddable widget MUST be framable on third-party sites, so the
    // clickjacking-protection X-Frame-Options: DENY (correct everywhere else)
    // would break it. /widget gets the same hardening minus that header, plus a
    // CSP frame-ancestors that explicitly permits framing anywhere. The global
    // rule excludes the /widget page (but still covers /widget.js, a plain
    // script that is never framed).
    const framableHeaders = [
      ...securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
      { key: "Content-Security-Policy", value: "frame-ancestors *" },
    ];
    return [
      {
        source: "/((?!widget(?:$|/)).*)",
        headers: securityHeaders,
      },
      {
        source: "/widget",
        headers: framableHeaders,
      },
    ];
  },
  // Old top-level content routes moved under /resources. Every pre-split post
  // was news; native posts in other categories get per-slug entries generated
  // from their frontmatter (nativePostRedirects, above), which must precede
  // the blanket news rule — first match wins.
  async redirects() {
    return [
      { source: "/blog", destination: "/resources/news", permanent: true },
      ...nativePostRedirects(),
      { source: "/blog/:slug", destination: "/resources/news/:slug", permanent: true },
      { source: "/videos", destination: "/resources/videos", permanent: true },
      // The fireworks report's launch URL moved to its permanent /reports/ slug.
      { source: "/fireworks", destination: "/reports/fireworks-fourth-july-2026", permanent: true },
    ];
  },
};

export default nextConfig;
