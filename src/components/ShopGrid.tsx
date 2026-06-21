"use client";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Product } from "@/lib/types";

export default function ShopGrid({ products }: { products: Product[] }) {
  const [active, setActive] = useState<Product | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {products.map((p) => (
          <button
            key={p.id ?? p.link}
            onClick={() => setActive(p)}
            className="overflow-hidden rounded-lg border border-border text-left transition-shadow hover:shadow-md"
          >
            {p.image && /* eslint-disable-next-line @next/next/no-img-element */ (
              <img src={p.image} alt={p.name} loading="lazy" className="aspect-square w-full object-cover" />
            )}
            <div className="p-2">
              <div className="text-sm font-semibold">{p.name}</div>
              {p.price && <div className="text-sm font-bold text-orange">{p.price}</div>}
            </div>
          </button>
        ))}
      </div>
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="h-[85vh] max-w-3xl p-0">
          {active && (
            <iframe src={active.link} title={active.name} className="h-full w-full rounded-md border-0" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
