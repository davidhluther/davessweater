import type { Video, Product } from "@/lib/types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const YOUTUBE_RSS =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCLQdHEMoKkrNc3PgWs3SksA";
const MERCHANT_FEED =
  "https://daves-sweater-shop.fourthwall.com/.well-known/merchant-center/rss.xml";

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : "";
}

export function parseYouTubeAtom(xml: string, max = 6): Video[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.slice(0, max).map((e) => {
    const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    const thumb = e.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ?? "";
    return { title: tag(e, "title"), link, date: tag(e, "published").slice(0, 10), thumb };
  });
}

export function parseMerchantRss(xml: string): Product[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const seen = new Map<string, Product>();
  for (const it of items) {
    const group = tag(it, "g:item_group_id");
    const id = tag(it, "g:id");
    const key = group || id;
    if (!key || seen.has(key)) continue;
    let name = tag(it, "g:title") || tag(it, "title");
    if (group && name.includes(" - ")) name = name.slice(0, name.lastIndexOf(" - "));
    const link = tag(it, "g:link") || tag(it, "link");
    const image = tag(it, "g:image_link");
    const priceRaw = tag(it, "g:price"); // "25.10 USD"
    let price = "";
    if (priceRaw) {
      const n = parseFloat(priceRaw.split(/\s+/)[0]);
      price = Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
    }
    seen.set(key, { name, link, image, price, id });
  }
  return [...seen.values()];
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

export async function getVideos(): Promise<Video[]> {
  const xml = await fetchText(YOUTUBE_RSS);
  return xml ? parseYouTubeAtom(xml) : [];
}

export async function getProducts(): Promise<Product[]> {
  const xml = await fetchText(MERCHANT_FEED);
  return xml ? parseMerchantRss(xml) : [];
}
