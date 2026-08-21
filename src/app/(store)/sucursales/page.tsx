import type { Metadata } from "next";
import { SucursalesMap } from "@/components/store/SucursalesMap";

export const metadata: Metadata = {
  title: "Sucursales · Pollería Entre Ríos",
  description: "Encontrá tu sucursal más cercana de Pollería Entre Ríos en Corrientes.",
};

export default async function SucursalesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  return (
    <div className="space-y-4 px-4 pt-4 md:px-6 md:pt-8">
      <div>
        <h1 className="text-lg font-bold text-brand-ink md:text-3xl">Nuestras Sucursales</h1>
        <p className="mt-1 text-sm text-brand-ink/60 md:text-base">
          Elegí una sucursal de la lista para verla en el mapa.
        </p>
      </div>
      <SucursalesMap key={s} initialId={s} />
    </div>
  );
}
