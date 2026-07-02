import type { NextConfig } from "next";

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Old top-level content routes moved under /resources. Every pre-split post
  // was news; a slug later shelved under Articles needs its own entry here.
  async redirects() {
    return [
      { source: "/blog", destination: "/resources/news", permanent: true },
      { source: "/blog/:slug", destination: "/resources/news/:slug", permanent: true },
      { source: "/videos", destination: "/resources/videos", permanent: true },
    ];
  },
};

export default nextConfig;
