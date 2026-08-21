"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { Novedad } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  saveNovedad,
  toggleNovedadActive,
  removeNovedad,
  type SaveNovedadState,
} from "./actions";

export function NovedadesManager({ novedades }: { novedades: Novedad[] }) {
  // null = cerrado, undefined = crear nueva, Novedad = editar
  const [editing, setEditing] = useState<Novedad | undefined | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Novedades</h1>
          <p className="text-sm text-brand-ink/55">
            {novedades.length} posteos en la sección “Novedades” de la home
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(undefined)}>
          <Plus size={16} /> Agregar novedad
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Imagen</th>
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {novedades.map((n) => (
                <tr key={n.id} className="border-t border-black/5 hover:bg-brand-cream/50">
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={n.image}
                      alt={n.title ?? "Novedad"}
                      className="h-12 w-20 rounded-lg object-cover"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-brand-ink">{n.title || "—"}</p>
                    {n.link && <p className="text-xs text-brand-ink/50">{n.link}</p>}
                  </td>
                  <td className="px-4 py-3 text-brand-ink/70">{n.position}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleNovedadActive(n.id, !n.active)}
                      title="Cambiar visibilidad"
                      className={cn(
                        "chip cursor-pointer",
                        n.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {n.active ? "Visible" : "Oculta"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setEditing(n)}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink/70 hover:bg-black/5"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("¿Eliminar esta novedad?")) removeNovedad(n.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {novedades.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-brand-ink/50">
                    Todavía no hay novedades cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && <NovedadModal novedad={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function NovedadModal({ novedad, onClose }: { novedad?: Novedad; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<SaveNovedadState, FormData>(saveNovedad, {});
  const [imagePreview, setImagePreview] = useState(novedad?.image ?? "");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">
            {novedad ? "Editar novedad" : "Nueva novedad"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-brand-ink/50 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <form action={formAction} className="space-y-4 text-sm">
          {novedad && <input type="hidden" name="id" value={novedad.id} />}

          <Field label="Título (opcional, se usa como texto alternativo)">
            <input name="title" defaultValue={novedad?.title} className="input-admin" />
          </Field>

          <Field label="Imagen (URL o ruta, ej. /promo.jpg)">
            <div className="flex items-center gap-3">
              <input
                name="image"
                defaultValue={novedad?.image}
                required
                className="input-admin flex-1"
                onChange={(e) => setImagePreview(e.target.value)}
              />
              {imagePreview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="h-12 w-20 rounded-lg object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                  onLoad={(e) => ((e.target as HTMLImageElement).style.visibility = "visible")}
                />
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Enlace al tocar (opcional, ej. /ofertas)">
              <input name="link" defaultValue={novedad?.link} className="input-admin" />
            </Field>
            <Field label="Orden (menor = primero)">
              <input
                name="position"
                type="number"
                step={1}
                defaultValue={novedad?.position ?? 0}
                className="input-admin"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 font-semibold text-brand-ink">
            <input
              name="active"
              type="checkbox"
              defaultChecked={novedad?.active ?? true}
              className="h-4 w-4 accent-brand-red"
            />
            Visible en la home
          </label>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 px-4 py-2 font-semibold text-brand-ink/70 hover:bg-black/5"
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold text-brand-ink">{label}</span>
      {children}
    </label>
  );
}
