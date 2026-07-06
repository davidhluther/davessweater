import { getProducts } from "@/lib/feeds";
import ShopGrid from "@/components/ShopGrid";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Swag Shop — Dave's Sweater merch",
  description:
    "Official Dave's Sweater merch: shirts, mugs, and other Boone weather-tracker gear at minimum price, with the mandatory $3 profit donated to charity each month.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Swag Shop — Dave's Sweater merch",
    description:
      "Shirts, mugs, and other Boone weather-tracker gear at minimum price; the mandatory $3 profit goes to charity.",
    url: "https://davessweater.com/shop",
    type: "website",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://davessweater.com" },
    { "@type": "ListItem", "position": 2, "name": "Swag Shop", "item": "https://davessweater.com/shop" },
  ],
};

export default async function Page() {
  const products = await getProducts();
  return (
    <>
    <JsonLd data={breadcrumbJsonLd} />
    <SectionBand>
      <h1 className="mb-2 font-display text-2xl font-bold text-foreground">Swag Shop</h1>
      <p className="mb-6 text-sm text-muted">
        The official Dave&apos;s Sweater merch, dropshipped so we don&apos;t keep boxes of stuff at our
        meteorological megaplex. Everything is set to the minimum price with a mandatory $3 &ldquo;profit&rdquo;
        baked in, which we donate to charity each month.
      </p>
      {products.length === 0 ? (
        <p className="text-muted">
          Shop is loading elsewhere —{" "}
          <a
            className="text-orange-600 hover:underline underline-offset-2"
            href="https://daves-sweater-shop.fourthwall.com/"
            target="_blank"
            rel="noopener"
          >
            visit the full shop ↗
          </a>
          .
        </p>
      ) : (
        <ShopGrid products={products} />
      )}
    </SectionBand>
    </>
  );
}
