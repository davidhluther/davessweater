import { getProducts } from "@/lib/feeds";
import ShopGrid from "@/components/ShopGrid";

export const metadata = { title: "Swag Shop" };

export default async function Page() {
  const products = await getProducts();
  return (
    <section className="rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-2 text-2xl font-bold">Swag Shop</h2>
      <p className="mb-4 text-sm text-muted">
        The official Dave&apos;s Sweater merch, dropshipped so we don&apos;t keep boxes of stuff at our
        meteorological megaplex. Everything is set to the minimum price with a mandatory $3 &ldquo;profit&rdquo;
        baked in, which we donate to charity each month.
      </p>
      {products.length === 0 ? (
        <p className="text-muted">Shop is loading elsewhere — <a className="text-orange" href="https://daves-sweater-shop.fourthwall.com/" target="_blank" rel="noopener">visit the full shop ↗</a>.</p>
      ) : <ShopGrid products={products} />}
    </section>
  );
}
