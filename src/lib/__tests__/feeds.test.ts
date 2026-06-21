import { describe, it, expect } from "vitest";
import { parseYouTubeAtom, parseMerchantRss } from "@/lib/feeds";

const ATOM = `<feed xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<entry><title>Vid One</title><link rel="alternate" href="https://youtu.be/abc"/>
<published>2026-06-01T12:00:00+00:00</published>
<media:group><media:thumbnail url="https://i.ytimg.com/vi/abc/hq.jpg"/></media:group></entry></feed>`;

const RSS = `<rss xmlns:g="http://base.google.com/ns/1.0"><channel>
<item><g:id>1</g:id><g:item_group_id>grp</g:item_group_id><g:title>Mug - Black</g:title>
<g:link>https://shop/x/mug</g:link><g:image_link>https://img/1.jpg</g:image_link><g:price>25.10 USD</g:price></item>
<item><g:id>2</g:id><g:item_group_id>grp</g:item_group_id><g:title>Mug - White</g:title>
<g:link>https://shop/x/mug</g:link><g:image_link>https://img/2.jpg</g:image_link><g:price>25.10 USD</g:price></item>
</channel></rss>`;

describe("feed parsers", () => {
  it("parses YouTube atom entries", () => {
    const v = parseYouTubeAtom(ATOM);
    expect(v[0]).toMatchObject({ title: "Vid One", link: "https://youtu.be/abc", date: "2026-06-01" });
    expect(v[0].thumb).toContain("ytimg");
  });
  it("parses + dedupes merchant products by item_group_id", () => {
    const p = parseMerchantRss(RSS);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ name: "Mug", price: "$25.10", image: "https://img/1.jpg" });
  });
});
