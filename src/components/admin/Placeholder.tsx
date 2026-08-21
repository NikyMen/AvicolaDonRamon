import { Construction } from "lucide-react";

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand-ink">{title}</h1>
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 text-center shadow-soft">
        <Construction size={42} className="mb-3 text-brand-gold" />
        <p className="font-semibold text-brand-ink">Sección en construcción</p>
        <p className="text-sm text-brand-ink/55">
          Este módulo estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
