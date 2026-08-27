"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bike,
  CalendarDays,
  Check,
  CheckSquare,
  ClipboardList,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Printer,
  Route,
  Square,
  Truck,
  X,
} from "lucide-react";
import { formatARS, formatDateTime } from "@/lib/format";
import { cerrarPedidosEnvio, type CerrarPedidosState } from "./actions";
import { distanceKm } from "@/lib/geo";
import { googleMapsRouteUrl, optimizeRoute } from "@/lib/route";

/** Envío pagado listo para despachar, con lo necesario para elegirlo y controlar stock. */
export interface EnvioPendiente {
  /** id que viaja al server para despachar (interno de la base o código). */
  id: string;
  /** Código visible del pedido (#1043). */
  code: string;
  customer: string;
  phone: string | null;
  address: string | null;
  date: string;
  total: number;
  items: { name: string; qty: number }[];
  mapUrl: string | null;
  lat: number | null;
  lng: number | null;
  /** Rango horario que eligió el cliente ("08:00 a 12:00"), si lo hay. */
  franjaHoraria: string | null;
  /** Id del rango horario ("08-12"), para agrupar la lista por franja. */
  slotId: string | null;
  /** Fecha calendario de entrega (YYYY-MM-DD), para separar franjas de distintos dias. */
  deliveryDate: string | null;
  /** El repartidor anterior canceló la entrega y necesita una nueva asignación. */
  isRetry: boolean;
}

interface Props {
  sucursales: { id: string; name: string; lat: number; lng: number }[];
  /** Repartidores activos del equipo, para asignarle el reparto a uno. */
  repartidores: { id: string; name: string }[];
  envios: EnvioPendiente[];
  /** Envíos que ya están en camino (reparto en curso). */
  enCurso?: number;
}

/** URL de la vista de etiquetas para un conjunto de pedidos. */
function etiquetasUrl(ids: string[]): string {
  const params = `ids=${encodeURIComponent(ids.join(","))}`;
  return `/admin/etiquetas?${params}`;
}

export function EntregasClient({ sucursales, repartidores, envios, enCurso = 0 }: Props) {
  const [sucursalId, setSucursalId] = useState(
    sucursales.find((s) => s.id === "don-ramon")?.id ?? sucursales[0]?.id ?? ""
  );
  const [repartidorId, setRepartidorId] = useState(repartidores[0]?.id ?? "");
  // Por defecto entran todos a la ruta; el encargado destilda los que no salen.
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set(envios.map((e) => e.id)));
  const [modalStock, setModalStock] = useState(false);
  const [state, setState] = useState<CerrarPedidosState | null>(null);
  /** Ids del último lote despachado, para poder imprimir sus etiquetas. */
  const [despachados, setDespachados] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const seleccionados = envios.filter((e) => seleccion.has(e.id));
  const todosMarcados = envios.length > 0 && seleccionados.length === envios.length;
  const previewRoute = useMemo(() => {
    const sucursal = sucursales.find((s) => s.id === sucursalId);
    if (!sucursal) return null;
    const origin = { lat: sucursal.lat, lng: sucursal.lng };
    const stops = seleccionados
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({ ...e, lat: e.lat as number, lng: e.lng as number }));
    const ordered = optimizeRoute(origin, stops);
    let km = 0;
    let current = origin;
    for (const stop of ordered) {
      km += distanceKm(current, stop);
      current = stop;
    }
    return {
      ordered,
      missing: seleccionados.length - ordered.length,
      km,
      mapsUrl: ordered.length
        ? googleMapsRouteUrl(
            origin,
            ordered.map((s) => ({ lat: s.lat, lng: s.lng }))
          )
        : "",
    };
  }, [seleccionados, sucursalId, sucursales]);

  // El orden ya viene definido por fecha y franja desde el servidor. El Map lo
  // conserva y evita mezclar, por ejemplo, sabado y lunes a la manana.
  const gruposEntrega = useMemo(() => {
    const grupos = new Map<string, { label: string; pedidos: EnvioPendiente[] }>();
    for (const envio of envios) {
      const key = `${envio.deliveryDate ?? "sin-fecha"}:${envio.slotId ?? "sin-horario"}`;
      const grupo = grupos.get(key) ?? {
        label: envio.franjaHoraria ?? "Sin fecha u horario asignado",
        pedidos: [],
      };
      grupo.pedidos.push(envio);
      grupos.set(key, grupo);
    }
    return [...grupos.entries()].map(([key, grupo]) => ({ key, ...grupo }));
  }, [envios]);

  // Total consolidado por producto de los pedidos seleccionados (para juntar
  // la mercadería de una sola vez antes de confirmar el stock).
  const totalesProducto = useMemo(() => {
    const acc = new Map<string, number>();
    for (const e of seleccionados) {
      for (const i of e.items) acc.set(i.name, (acc.get(i.name) ?? 0) + i.qty);
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
  }, [seleccionados]);

  const toggle = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    setSeleccion(todosMarcados ? new Set() : new Set(envios.map((e) => e.id)));
  };

  const confirmarStock = () => {
    if (!sucursalId || !repartidorId || pending || seleccionados.length === 0) return;
    const ids = seleccionados.map((e) => e.id);
    setState(null);
    startTransition(async () => {
      try {
        const res = await cerrarPedidosEnvio(sucursalId, ids, repartidorId);
        setState(res);
        if (res.ok) {
          setDespachados(ids);
          setModalStock(false);
          setSeleccion(new Set());
        }
      } catch {
        setState({
          error: "Se perdió la conexión al cerrar el lote. Actualizá la página antes de reintentar.",
        });
      }
    });
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Truck size={18} className="text-brand-red" />
        <h2 className="font-semibold text-brand-ink">Cerrar pedidos para enviar</h2>
        <span className="chip bg-blue-100 text-blue-700">{envios.length}</span>
      </div>

      {enCurso > 0 && (
        <p className="mb-3 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700">
          Hay {enCurso} {enCurso === 1 ? "envío" : "envíos"} en camino. Podés cerrar un nuevo lote
          con los envíos que se sigan pagando.
        </p>
      )}

      <p className="mb-3 text-sm text-brand-ink/60">
        Elegí qué pedidos entran en el reparto y qué repartidor sale con ellos. La lista está
        agrupada por fecha y franja horaria; dentro de cada columna, arriba quedan los que pidieron
        primero. Antes de armar la ruta te mostramos el total de productos para que confirmes el
        stock; después avisamos a cada cliente que su pedido salió. El repartidor ve su ruta
        entrando con su usuario en <b>/reparto</b>.
      </p>

      {/* Sucursal de salida + repartidor asignado */}
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/70">
            Sucursal de salida
          </span>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
          >
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-brand-ink/70">
            <Bike size={13} /> Repartidor a cargo
          </span>
          <select
            value={repartidorId}
            onChange={(e) => setRepartidorId(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
          >
            {repartidores.length === 0 && <option value="">No hay repartidores activos</option>}
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {repartidores.length === 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
          No hay repartidores activos en el equipo. Cargá uno en <b>Equipo</b> (rol
          &quot;repartidor&quot;, con usuario y contraseña) para poder cerrar pedidos.
        </p>
      )}

      {/* Selección de pedidos para la ruta */}
      {envios.length === 0 ? (
        <p className="rounded-lg bg-brand-cream/60 px-3 py-3 text-sm text-brand-ink/50">
          No hay envíos pagados esperando despacho.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={toggleTodos}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-black/5"
            >
              {todosMarcados ? <CheckSquare size={14} /> : <Square size={14} />}
              {todosMarcados ? "Ninguno" : "Seleccionar todos"}
            </button>
            <span className="text-xs font-semibold text-brand-ink/60">
              {seleccionados.length} de {envios.length} en la ruta
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {gruposEntrega.map((grupo) => {
              return (
                <div key={grupo.key} className="overflow-hidden rounded-xl border border-black/5">
                  <div className="flex items-center gap-2 bg-brand-cream/70 px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-ink/60">
                    <CalendarDays size={13} className="text-brand-red" />
                    <Clock size={12} className="text-brand-red" />
                    {grupo.label}
                    <span className="ml-auto font-semibold normal-case tracking-normal text-brand-ink/45">
                      {grupo.pedidos.length} {grupo.pedidos.length === 1 ? "pedido" : "pedidos"}
                    </span>
                  </div>
                  <ul className="divide-y divide-black/5">
                    {grupo.pedidos.map((e) => {
                      const marcado = seleccion.has(e.id);
                      return (
                        <li
                          key={e.id}
                          className={`flex items-start gap-3 px-3 py-3 text-sm transition ${
                            marcado ? "bg-brand-cream/40" : "bg-white opacity-60"
                          }`}
                        >
                          <label className="flex flex-1 cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggle(e.id)}
                              className="mt-1 h-4 w-4 flex-none accent-[#FF0A0A]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2">
                                <b className="text-brand-ink">{e.code}</b>
                                <span className="font-medium text-brand-ink">{e.customer}</span>
                                {e.isRetry && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                    Reasignado
                                  </span>
                                )}
                                {e.phone && <span className="text-brand-ink/50">· {e.phone}</span>}
                                <span className="ml-auto text-xs text-brand-ink/50">
                                  {formatDateTime(e.date)}
                                </span>
                              </span>
                              {e.address && (
                                <span className="block truncate text-brand-ink/60">{e.address}</span>
                              )}
                              {e.franjaHoraria && (
                                <span className="block text-xs font-bold text-brand-red">
                                  Entrega: {e.franjaHoraria}
                                </span>
                              )}
                              <span className="block text-xs text-brand-ink/55">
                                {e.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} ·{" "}
                                <b className="text-brand-ink/80">{formatARS(e.total)}</b>
                              </span>
                            </span>
                          </label>
                          <span className="flex flex-none items-center gap-1 pt-0.5">
                            <a
                              href={etiquetasUrl([e.id])}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Imprimir etiqueta del pedido"
                              className="rounded-lg border border-black/10 p-1.5 text-brand-ink/60 hover:bg-black/5 hover:text-brand-ink"
                            >
                              <Printer size={14} />
                            </a>
                            {e.mapUrl && (
                              <a
                                href={e.mapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver en el mapa"
                                className="rounded-lg border border-black/10 p-1.5 text-brand-red hover:bg-black/5"
                              >
                                <MapPin size={14} />
                              </a>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          {envios.some((e) => !e.deliveryDate || !e.slotId) && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Hay pedidos sin fecha o franja horaria asignada; revisalos antes de cerrar el reparto.
            </p>
          )}

          {previewRoute && seleccionados.length > 0 && (
            <div className="mt-3 rounded-xl border border-black/10 bg-brand-cream/50 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Route size={16} className="text-brand-red" />
                <h3 className="text-sm font-bold text-brand-ink">Previsualizacion de ruta</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-ink/60">
                  {previewRoute.ordered.length} paradas · {previewRoute.km.toFixed(1)} km aprox.
                </span>
                {previewRoute.mapsUrl && (
                  <a
                    href={previewRoute.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-bold text-brand-red hover:bg-black/5"
                  >
                    <ExternalLink size={13} /> Abrir en Maps
                  </a>
                )}
              </div>
              {previewRoute.missing > 0 && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  {previewRoute.missing} pedido(s) seleccionado(s) no tienen punto de mapa y no entran en la previsualizacion.
                </p>
              )}
              <ol className="grid gap-2 md:grid-cols-2">
                {previewRoute.ordered.slice(0, 8).map((stop, i) => (
                  <li
                    key={stop.id}
                    className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-brand-ink/70"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <b className="text-brand-ink">{stop.code}</b> · {stop.customer}
                    </span>
                  </li>
                ))}
              </ol>
              {previewRoute.ordered.length > 8 && (
                <p className="mt-2 text-xs font-medium text-brand-ink/45">
                  Se muestran las primeras 8 paradas; Maps abre la ruta completa.
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModalStock(true)}
              disabled={pending || seleccionados.length === 0 || !sucursalId || !repartidorId}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
                pending || seleccionados.length === 0 || !sucursalId || !repartidorId
                  ? "cursor-not-allowed bg-black/20"
                  : "bg-brand-red hover:brightness-95"
              }`}
            >
              <ClipboardList size={16} />
              Controlar stock y cerrar ({seleccionados.length})
            </button>
            {seleccionados.length > 0 && (
              <a
                href={etiquetasUrl(seleccionados.map((e) => e.id))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-black/5"
              >
                <Printer size={15} /> Imprimir etiquetas
              </a>
            )}
          </div>
        </>
      )}

      {state?.error && (
        <p className="mt-3 rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="mt-3 space-y-2 rounded-lg bg-emerald-50 px-3 py-3 text-sm">
          <p className="font-semibold text-emerald-700">
            ✅ Despachamos {state.count} {state.count === 1 ? "envío" : "envíos"}. Ruta optimizada
            lista.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {state.mapsUrl && (
              <a
                href={state.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-red hover:underline"
              >
                <ExternalLink size={14} /> Abrir ruta en Google Maps
              </a>
            )}
            {despachados.length > 0 && (
              <a
                href={etiquetasUrl(despachados)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline"
              >
                <Printer size={14} /> Imprimir etiquetas del reparto
              </a>
            )}
          </div>
        </div>
      )}

      {/* Modal: control de stock antes de armar la ruta */}
      {modalStock && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => !pending && setModalStock(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
              <ClipboardList size={18} className="text-brand-red" />
              <h3 className="font-semibold text-brand-ink">Controlá el stock antes de salir</h3>
              <button
                onClick={() => !pending && setModalStock(false)}
                className="ml-auto rounded-lg p-1.5 text-brand-ink/50 hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-cream/60 px-3 py-2 text-sm text-brand-ink/70">
                <Bike size={14} className="flex-none text-brand-red" />
                <span>
                  Sale <b>{repartidores.find((r) => r.id === repartidorId)?.name ?? "—"}</b> desde{" "}
                  <b>{sucursales.find((s) => s.id === sucursalId)?.name ?? "—"}</b>
                </span>
              </p>

              {/* Totales consolidados */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
                Total a preparar ({seleccionados.length}{" "}
                {seleccionados.length === 1 ? "pedido" : "pedidos"})
              </p>
              <ul className="mb-4 overflow-hidden rounded-xl border border-black/10">
                {totalesProducto.map(([name, qty]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 border-b border-black/5 bg-brand-cream/40 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="font-medium text-brand-ink">{name}</span>
                    <span className="rounded-lg bg-brand-ink px-2 py-0.5 text-sm font-bold text-white">
                      {qty}×
                    </span>
                  </li>
                ))}
              </ul>

              {/* Detalle por pedido */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
                Detalle por pedido
              </p>
              <div className="space-y-2">
                {seleccionados.map((e) => (
                  <details key={e.id} className="rounded-xl border border-black/10">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                      <b className="text-brand-ink">{e.code}</b>
                      <span className="min-w-0 flex-1 truncate text-brand-ink/70">
                        {e.customer}
                      </span>
                      <span className="text-xs text-brand-ink/50">
                        {e.items.reduce((n, i) => n + i.qty, 0)} items
                      </span>
                    </summary>
                    <ul className="border-t border-black/5 px-3 py-2 text-sm text-brand-ink/70">
                      {e.items.map((i) => (
                        <li key={i.name} className="flex justify-between py-0.5">
                          <span>{i.name}</span>
                          <b className="text-brand-ink">{i.qty}×</b>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-black/5 px-4 py-3">
              <a
                href={etiquetasUrl(seleccionados.map((e) => e.id))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-black/5"
              >
                <Printer size={15} /> Etiquetas
              </a>
              <button
                onClick={() => setModalStock(false)}
                disabled={pending}
                className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink/60 hover:bg-black/5"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarStock}
                disabled={pending}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
                  pending ? "cursor-not-allowed bg-black/20" : "bg-emerald-600 hover:brightness-95"
                }`}
              >
                {pending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {pending ? "Cerrando…" : "Confirmo que hay stock, cerrar lote y armar ruta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
