"use client";

import { useState } from "react";
import { Check, EyeOff, SlidersHorizontal } from "lucide-react";
import { setAdvancedReportsAction, setHiddenModulesAction } from "./actions";

const modules = [
  ["dashboard", "Dashboard"], ["analitica", "Analítica"],
  ["entregas", "Entregas"], ["envios", "Envios"], ["ofertas", "Ofertas"],
  ["sucursales", "Sucursales"], ["clientes", "Clientes"], ["cupones", "Cupones y promos"],
  ["mayorista", "Stock mayorista"],
];

export function ConfigSettings({
  hiddenModules,
  advancedReports,
  canManage,
}: {
  hiddenModules: string[];
  advancedReports: boolean;
  canManage: boolean;
}) {
  const [hidden, setHidden] = useState<string[]>(hiddenModules);
  const [advanced, setAdvanced] = useState(advancedReports);
  const [error, setError] = useState("");

  async function toggleModule(key: string) {
    const next = hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key];
    setHidden(next);
    const result = await setHiddenModulesAction(next);
    if (result.error) {
      setError(result.error);
      setHidden(hidden);
    }
  }

  async function toggleAdvanced() {
    const next = !advanced;
    setAdvanced(next);
    const result = await setAdvancedReportsAction(next);
    if (result.error) {
      setError(result.error);
      setAdvanced(advanced);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"><SlidersHorizontal size={18} /></span><div><h2 className="font-semibold text-brand-ink">Módulos del panel</h2><p className="text-sm text-brand-ink/55">Ocultá accesos que no necesitás ver en el menú. Aplica a todo el equipo, en cualquier computadora.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map(([key, label]) => <label key={key} className={`flex items-center gap-3 rounded-xl border border-black/10 px-3 py-3 text-sm text-brand-ink hover:bg-black/[.02] ${canManage ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}><input type="checkbox" checked={!hidden.includes(key)} disabled={!canManage} onChange={() => toggleModule(key)} className="accent-brand-red" /><span className="flex-1">{label}</span>{!hidden.includes(key) && <Check size={16} className="text-brand-red" />}</label>)}
        </div>
        {!canManage ? (
          <p className="mt-3 text-xs text-brand-ink/45">Solo el administrador puede cambiar qué módulos ve el equipo.</p>
        ) : null}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"><EyeOff size={18} /></span><div className="flex-1"><h2 className="font-semibold text-brand-ink">Datos avanzados en IA y reportes</h2><p className="text-sm text-brand-ink/55">Muestra clientes totales, nuevos por período, evolución mensual y top compradores.</p></div><button type="button" onClick={toggleAdvanced} disabled={!canManage} aria-pressed={advanced} className={`relative h-6 w-11 rounded-full transition disabled:opacity-60 ${advanced ? "bg-brand-red" : "bg-black/20"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${advanced ? "left-6" : "left-1"}`} /></button></div>
      </section>
    </div>
  );
}
