// Same card for the twitter:image slot (some crawlers ignore the og:image
// fallback when the card type is summary_large_image). generateStaticParams is
// re-exported too: without it this route prerenders nothing and stays a
// serverless function against the Vercel Hobby 12-function ceiling.
export { default, alt, size, contentType, generateStaticParams } from "./opengraph-image";

// Declared locally, not re-exported: Next.js parses this field statically and
// rejects a re-export ("it mustn't be reexported"). Keep it in sync with
// opengraph-image.tsx.
export const dynamicParams = false;
