import type { Metadata } from "next";
import { SucursalesMap } from "@/components/store/SucursalesMap";

export const metadata: Metadata = {
  title: "Ubicación · Avícola Don Ramón",
  description: "Encontrá Avícola Don Ramón en Paraná, Entre Ríos.",
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
        <h1 className="text-lg font-bold text-brand-ink md:text-3xl">Dónde estamos</h1>
        <p className="mt-1 text-sm text-brand-ink/60 md:text-base">
          Consultá la dirección del local en el mapa.
        </p>
      </div>
      <SucursalesMap key={s} initialId={s} />
    </div>
  );
}
