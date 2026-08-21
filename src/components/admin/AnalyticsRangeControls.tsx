"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const PRESETS = [
  { key: "7d", label: "Últimos 7 días" },
  { key: "1m", label: "Último mes" },
  { key: "3m", label: "Últimos 3 meses" },
] as const;

export function AnalyticsRangeControls({
  preset,
  from,
  to,
}: {
  preset: string | null;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);

  function applyPreset(key: string) {
    router.push(`/admin/analitica?preset=${key}`);
  }

  function applyCustom() {
    if (!fromDraft || !toDraft) return;
    const params = new URLSearchParams({ from: fromDraft, to: toDraft });
    router.push(`/admin/analitica?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-soft">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition",
              preset === p.key
                ? "bg-brand-red text-white"
                : "bg-brand-cream text-brand-ink/70 hover:bg-black/5"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/55">Desde</span>
          <input
            type="date"
            value={fromDraft}
            max={toDraft || undefined}
            onChange={(e) => setFromDraft(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/55">Hasta</span>
          <input
            type="date"
            value={toDraft}
            min={fromDraft || undefined}
            onChange={(e) => setToDraft(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
          />
        </label>
        <button
          onClick={applyCustom}
          disabled={!fromDraft || !toDraft}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold",
            !fromDraft || !toDraft
              ? "bg-black/5 text-brand-ink/40"
              : preset === null
                ? "bg-brand-red text-white hover:bg-brand-red/90"
                : "border border-black/10 text-brand-ink/70 hover:bg-black/5"
          )}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
