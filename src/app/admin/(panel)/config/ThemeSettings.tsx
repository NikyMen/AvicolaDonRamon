"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ACCENT_THEMES,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  applyAccent,
  type AccentKey,
} from "@/lib/theme";

export function ThemeSettings() {
  const [accent, setAccent] = useState<AccentKey>(DEFAULT_ACCENT);

  // Sincroniza con lo guardado al montar (el script inline ya lo aplicó antes del paint).
  useEffect(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentKey | null;
    if (saved && ACCENT_THEMES.some((t) => t.key === saved)) setAccent(saved);
  }, []);

  function choose(key: AccentKey) {
    setAccent(key);
    localStorage.setItem(ACCENT_STORAGE_KEY, key);
    applyAccent(key);
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
          <Palette size={18} />
        </span>
        <div>
          <h2 className="font-semibold text-brand-ink">Color de acento</h2>
          <p className="text-sm text-brand-ink/55">
            Elegí el color principal del panel y la tienda en este dispositivo.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ACCENT_THEMES.map((t) => {
          const active = accent === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => choose(t.key)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                active
                  ? "border-brand-red bg-brand-red/5 ring-1 ring-brand-red"
                  : "border-black/10 hover:bg-black/5"
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: t.swatch }}
              >
                {active && <Check size={16} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-brand-ink">
                  {t.label}
                </span>
                <span className="block truncate text-xs text-brand-ink/55">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
