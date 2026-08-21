"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, MapPinned, Truck } from "lucide-react";
import { saveEnvios, type SaveEnviosState } from "./actions";
import type { DeliverySettings } from "@/lib/types";

export function EnviosSettingsForm({
  settings,
  originName,
}: {
  settings: DeliverySettings;
  originName: string;
}) {
  const [state, formAction, pending] = useActionState<SaveEnviosState, FormData>(saveEnvios, {});

  return (
    <form action={formAction} className="space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Truck size={19} className="text-brand-red" />
          <div>
            <h2 className="font-semibold text-brand-ink">Costo de envio</h2>
            <p className="text-sm text-brand-ink/55">
              El cliente ve solo el importe final del envio, no el precio por kilometro.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-ink/55">
              Precio por km
            </span>
            <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white">
              <span className="flex items-center border-r border-black/10 bg-brand-cream px-3 text-sm font-bold text-brand-ink/55">
                $
              </span>
              <input
                name="pricePerKm"
                type="number"
                min="0"
                step="1"
                defaultValue={settings.pricePerKm}
                className="min-w-0 flex-1 px-3 py-2.5 text-sm font-semibold text-brand-ink outline-none"
              />
            </div>
          </label>

          <div className="rounded-xl border border-black/10 bg-brand-cream/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-ink">
              <MapPinned size={16} className="text-brand-red" />
              Sucursal fija de salida
            </div>
            <p className="text-sm text-brand-ink/70">{originName}</p>
            <p className="mt-1 text-xs text-brand-ink/45">
              Por ahora todos los costos se calculan desde esta sucursal.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="mb-3 font-semibold text-brand-ink">Bonificaciones</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border border-black/10 bg-brand-cream/40 p-3">
            <input
              name="freeAllSlots"
              type="checkbox"
              defaultChecked={settings.freeAllSlots}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
            />
            <span>
              <span className="block text-sm font-bold text-brand-ink">
                Envio gratis todos los horarios
              </span>
              <span className="text-xs text-brand-ink/55">
                Fuerza costo $0 para cualquier entrega.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-black/10 bg-brand-cream/40 p-3">
            <input
              name="freeSaturday"
              type="checkbox"
              defaultChecked={settings.freeSaturday}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
            />
            <span>
              <span className="block text-sm font-bold text-brand-ink">
                Envio gratis los sabados
              </span>
              <span className="text-xs text-brand-ink/55">
                Se aplica cuando la fecha de entrega elegida cae sabado.
              </span>
            </span>
          </label>
        </div>
      </section>

      {state.error && (
        <p className="rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> Configuracion guardada.
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        {pending ? "Guardando..." : "Guardar configuracion"}
      </button>
    </form>
  );
}
