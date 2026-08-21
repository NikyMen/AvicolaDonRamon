import { History, PackageCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { RouteHistory } from "@/lib/repo";

interface Props {
  rutas: RouteHistory[];
  staffName: (id?: string) => string | null;
  sucursalName: (id?: string) => string;
}

function loteLabel(batchId: string) {
  return batchId.startsWith("legacy:") ? "Lote anterior" : `Lote ${batchId.slice(0, 8).toUpperCase()}`;
}

function horaEntrega(order: RouteHistory["orders"][number]) {
  const iso = order.deliveredAt ?? (order.status === "entregado" ? order.updatedAt : undefined);
  return iso ? formatDateTime(iso) : "Pendiente";
}

export function HistorialRutas({ rutas, staffName, sucursalName }: Props) {
  return (
    <section id="historial-rutas" className="rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <History size={18} className="text-brand-gold" />
        <div>
          <h2 className="font-semibold text-brand-ink">Historial de rutas y pedidos</h2>
          <p className="text-xs text-brand-ink/50">Lotes cerrados, códigos y hora real de entrega.</p>
        </div>
        <span className="chip bg-brand-cream text-brand-ink/70">{rutas.length} lotes</span>
      </div>

      {rutas.length === 0 ? (
        <p className="rounded-lg bg-brand-cream/60 px-3 py-3 text-sm text-brand-ink/50">
          Todavía no hay lotes cerrados.
        </p>
      ) : (
        <div className="space-y-2">
          {rutas.map((ruta) => (
            <details key={ruta.batchId} className="overflow-hidden rounded-xl border border-black/10">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <PackageCheck size={16} className="text-emerald-600" />
                <b className="text-brand-ink">{loteLabel(ruta.batchId)}</b>
                <span className="text-brand-ink/55">{ruta.orders.length} pedidos</span>
                <span className="text-brand-ink/55">· {staffName(ruta.repartidorId) ?? "Sin asignar"}</span>
                <span className="ml-auto text-xs text-brand-ink/50">
                  Cerrado {ruta.closedAt ? formatDateTime(ruta.closedAt) : "—"}
                </span>
              </summary>
              <div className="border-t border-black/5 bg-brand-cream/20 px-3 py-3">
                <p className="mb-2 text-xs text-brand-ink/55">
                  Salió {ruta.dispatchedAt ? formatDateTime(ruta.dispatchedAt) : "—"} desde {sucursalName(ruta.originSucursalId)}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="text-brand-ink/50">
                      <tr>
                        <th className="px-2 py-1.5">Parada</th>
                        <th className="px-2 py-1.5">Pedido / cliente</th>
                        <th className="px-2 py-1.5">Código cliente</th>
                        <th className="px-2 py-1.5">Hora de entrega</th>
                        <th className="px-2 py-1.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ruta.orders.map((order) => (
                        <tr key={order.internalId ?? order.id} className="border-t border-black/5">
                          <td className="px-2 py-2 font-bold text-brand-ink">{order.routeSeq ?? "—"}</td>
                          <td className="px-2 py-2">
                            <b className="text-brand-ink">{order.id}</b>
                            <span className="ml-2 text-brand-ink/65">{order.customer}</span>
                          </td>
                          <td className="px-2 py-2 font-mono font-bold tracking-wider text-brand-ink/75">
                            {order.deliveryCode ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-brand-ink/70">{horaEntrega(order)}</td>
                          <td
                            className={`px-2 py-2 font-semibold ${
                              order.deliveryRetryAt ? "text-amber-700" : "text-emerald-700"
                            }`}
                          >
                            {order.deliveryRetryAt
                              ? "Reasignado"
                              : order.status === "entregado"
                                ? "Entregado"
                                : order.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
