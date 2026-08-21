"use client";

import { useEffect, useState } from "react";
import { Check, EyeOff, SlidersHorizontal } from "lucide-react";

const HIDDEN_MODULES_KEY = "admin:hidden-modules";
const ADVANCED_REPORTS_KEY = "admin:advanced-report-data";
const modules = [
  ["entregas", "Entregas"], ["envios", "Envios"], ["ofertas", "Ofertas"],
  ["clientes", "Clientes"], ["cupones", "Cupones y promos"],
];

export function ConfigSettings() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(true);

  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(HIDDEN_MODULES_KEY) ?? "[]");
      if (Array.isArray(value)) setHidden(value);
      setAdvanced(localStorage.getItem(ADVANCED_REPORTS_KEY) !== "false");
    } catch {}
  }, []);

  function toggleModule(key: string) {
    setHidden((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      localStorage.setItem(HIDDEN_MODULES_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleAdvanced() {
    setAdvanced((current) => {
      const next = !current;
      localStorage.setItem(ADVANCED_REPORTS_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"><SlidersHorizontal size={18} /></span><div><h2 className="font-semibold text-brand-ink">Módulos del panel</h2><p className="text-sm text-brand-ink/55">Ocultá accesos que no necesitás ver en el menú.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-3 text-sm text-brand-ink hover:bg-black/[.02]"><input type="checkbox" checked={!hidden.includes(key)} onChange={() => toggleModule(key)} className="accent-brand-red" /><span className="flex-1">{label}</span>{!hidden.includes(key) && <Check size={16} className="text-brand-red" />}</label>)}
        </div>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red"><EyeOff size={18} /></span><div className="flex-1"><h2 className="font-semibold text-brand-ink">Datos avanzados en IA y reportes</h2><p className="text-sm text-brand-ink/55">Muestra clientes totales, nuevos por período, evolución mensual y top compradores.</p></div><button type="button" onClick={toggleAdvanced} aria-pressed={advanced} className={`relative h-6 w-11 rounded-full transition ${advanced ? "bg-brand-red" : "bg-black/20"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${advanced ? "left-6" : "left-1"}`} /></button></div>
      </section>
    </div>
  );
}
