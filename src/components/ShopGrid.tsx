import type { Product } from "@/lib/types";

// Product tiles link straight to Fourthwall rather than embedding it: the
// storefront (home and every product page) sends X-Frame-Options: SAMEORIGIN,
// so an iframe from davessweater.com is always blocked by the browser — it
// can never render, no matter which product or how the request is made.
export default function ShopGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {products.map((p) => (
        <a
          key={p.id ?? p.link}
          href={p.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border border-border text-left transition-shadow hover:shadow-md"
        >
          {p.image && /* eslint-disable-next-line @next/next/no-img-element */ (
            <img src={p.image} alt={p.name} loading="lazy" className="aspect-square w-full object-cover" />
          )}
          <div className="p-2">
            <div className="text-sm font-semibold">{p.name}</div>
            {p.price && <div className="text-sm font-bold text-orange-600">{p.price}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}
