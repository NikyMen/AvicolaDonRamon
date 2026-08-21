"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/cn";
import { setDailyOffer, setOffer } from "./actions";

export function OfertasManager({ products }: { products: Product[] }) {
  const dailyOffersCount = products.filter((p) => p.dailyOffer).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Ofertas</h1>
        <p className="text-sm text-brand-ink/55">
          Tildá los productos que querés mostrar en “Ofertas del día” en la home. El precio
          rebajado es opcional: si no lo cargás, se muestra el precio normal. · {dailyOffersCount}{" "}
          {dailyOffersCount === 1 ? "producto seleccionado" : "productos seleccionados"}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        {products.length === 0 ? (
          <p className="p-10 text-center text-sm text-brand-ink/50">
            No hay productos en el catálogo.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {products.map((p) => (
              <OfferRow key={p.id} product={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OfferRow({ product }: { product: Product }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasDiscount = product.oldPrice != null;
  const normalPrice = product.oldPrice ?? product.price;
  const currentOffer = hasDiscount ? product.price : "";
  const [draft, setDraft] = useState<string>(String(currentOffer));

  function refreshWith(result: { error?: string }) {
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function onToggleDailyOffer(checked: boolean) {
    setError(null);
    startTransition(async () => {
      refreshWith(await setDailyOffer(product.id, checked));
    });
  }

  function onSavePrice() {
    const value = Math.round(Number(draft));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Ingresá un precio válido.");
      return;
    }
    setError(null);
    startTransition(async () => {
      refreshWith(await setOffer(product.id, value));
    });
  }

  function removeDiscount() {
    setError(null);
    setDraft("");
    startTransition(async () => {
      refreshWith(await setOffer(product.id, null));
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={product.dailyOffer}
          disabled={pending}
          onChange={(e) => onToggleDailyOffer(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-brand-red"
          aria-label={`Mostrar ${product.name} en Ofertas del día`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-brand-ink">{product.name}</p>
          <p className="text-sm">
            {hasDiscount ? (
              <>
                <span className="font-semibold text-brand-red">{formatARS(product.price)}</span>{" "}
                <span className="text-brand-ink/40 line-through">{formatARS(normalPrice)}</span>
              </>
            ) : (
              <span className="text-brand-ink/60">{formatARS(normalPrice)} · Sin rebaja</span>
            )}
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            product.dailyOffer ? "bg-brand-gold/30 text-brand-ink" : "bg-black/5 text-brand-ink/45"
          )}
        >
          {product.dailyOffer ? "En Ofertas del día" : "No está en la home"}
        </span>
        <div className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5">
          <span className="text-xs font-semibold text-brand-ink/45">$</span>
          <input
            type="number"
            min={1}
            step={1}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            className="w-24 bg-transparent text-sm font-semibold text-brand-ink outline-none"
            placeholder="Rebaja opcional"
            aria-label={`Precio rebajado de ${product.name}`}
          />
        </div>
        <button
          onClick={onSavePrice}
          disabled={pending || !draft || draft === String(currentOffer)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold",
            pending || !draft || draft === String(currentOffer)
              ? "bg-black/5 text-brand-ink/40"
              : "bg-brand-red text-white hover:bg-brand-red/90"
          )}
        >
          {pending ? "…" : "Guardar"}
        </button>
        {hasDiscount && (
          <button
            onClick={removeDiscount}
            disabled={pending}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-ink/50 hover:bg-black/5"
          >
            Quitar rebaja
          </button>
        )}
        {!hasDiscount && <Tag size={14} className="text-brand-ink/35" aria-label="Sin rebaja" />}
      </div>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}
