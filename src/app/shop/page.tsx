import { getProducts } from "@/lib/feeds";
import ShopGrid from "@/components/ShopGrid";
import SectionBand from "@/components/SectionBand";

export const metadata = { title: "Swag Shop" };

export default async function Page() {
  const products = await getProducts();
  return (
    <SectionBand>
      <h2 className="mb-2 font-display text-2xl font-bold text-foreground">Swag Shop</h2>
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
  );
}
