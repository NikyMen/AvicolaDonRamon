import { Tag } from "lucide-react";
import { listProducts, listOffers, getSuperOferta } from "@/lib/repo";
import { ProductCard } from "@/components/store/ProductCard";
import { SuperOfertaHero } from "@/components/store/SuperOfertaHero";

export const dynamic = "force-dynamic";

const SUPER_OFERTA_PRODUCT_ID = "p-pata-muslo-10kg";

export default async function OfertasPage() {
  const [ofertas, all, superOferta] = await Promise.all([
    listOffers(),
    listProducts(),
    getSuperOferta(),
  ]);
  const ofertasDeLaSemana = ofertas.filter((p) => p.id !== SUPER_OFERTA_PRODUCT_ID);
  const populares = all.filter(
    (p) =>
      p.id !== SUPER_OFERTA_PRODUCT_ID &&
      (p.badge === "Más vendido" || p.badge === "Promo del día")
  );

  return (
    <div className="space-y-6 pb-4 md:space-y-8">
      {/* 1º: la Super Oferta del día, en dorado y con todo el protagonismo */}
      {superOferta.active && (
        <SuperOfertaHero
          oferta={superOferta}
          cartProduct={all.find((p) => p.id === superOferta.cartProductId)}
          tone="gold"
        />
      )}

      <div className="space-y-6 px-4 md:px-6">
        {/* 2º: las ofertas seleccionadas desde el panel */}
        <div className="flex items-center gap-2 rounded-2xl bg-brand-red p-4 text-white shadow-soft">
          <Tag size={28} />
          <div>
            <h1 className="text-lg font-bold leading-tight">Ofertas de la semana</h1>
            <p className="text-sm text-white/80">Aprovechá los mejores precios</p>
          </div>
        </div>

        {ofertasDeLaSemana.length > 0 && (
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {ofertasDeLaSemana.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-bold text-brand-ink">Más pedidos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {populares.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
