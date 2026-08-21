import { listOrders, listActiveRoute, listRouteHistory, listStaff } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { sucursales } from "@/lib/sucursales";
import { googleMapsPointUrl, googleMapsRouteUrl, DEFAULT_ROUTE_ORIGIN } from "@/lib/route";
import { deliveryEstimateLabel, DELIVERY_SLOTS } from "@/lib/entrega";
import type { Order } from "@/lib/types";
import { EntregasClient, type EnvioPendiente } from "./EntregasClient";
import type { RutaStop, RutaEnCursoProps } from "./RutaEnCursoClient";
import { RepartidoresActivos, type RepartidorActivo } from "./RepartidoresActivos";
import { HistorialRutas } from "./HistorialRutas";

export const dynamic = "force-dynamic";

function sucursalName(id?: string) {
  return sucursales.find((s) => s.id === id)?.name ?? id ?? "—";
}

/** Posición de la franja horaria para ordenar: primero la mañana, después la tarde. */
function slotOrder(id?: string) {
  const i = DELIVERY_SLOTS.findIndex((s) => s.id === id);
  return i === -1 ? DELIVERY_SLOTS.length : i;
}

export default async function EntregasPage() {
  await requirePerm("entregas");

  const [listos, ruta, historial, equipo] = await Promise.all([
    listOrders({ statusIn: ["en_preparacion", "cancelado"] }),
    listActiveRoute(),
    listRouteHistory(),
    listStaff(),
  ]);
  const repartidores = equipo
    .filter((s) => s.role === "repartidor" && s.active)
    .map((s) => ({ id: s.id, name: s.name }));
  const staffName = (id?: string) => equipo.find((s) => s.id === id)?.name ?? null;

  // Todos los pedidos son envíos a domicilio (no existe el retiro por sucursal).
  // Se ordenan por fecha estimada, franja y antigüedad.
  const envios = listos
    .filter(
      (order) =>
        order.status === "en_preparacion" ||
        (order.status === "cancelado" && Boolean(order.paidAt) && Boolean(order.deliveryRetryAt))
    )
    .sort(
      (a, b) =>
        (a.deliveryDate ?? "9999-12-31").localeCompare(b.deliveryDate ?? "9999-12-31") ||
        slotOrder(a.deliverySlot) - slotOrder(b.deliverySlot) ||
        a.date.localeCompare(b.date)
    );
  const enCamino = ruta.filter((o) => o.status === "en_camino");

  const sucursalOptions = sucursales.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));

  // Envíos pendientes con lo necesario para elegirlos y controlar el stock.
  const enviosPendientes: EnvioPendiente[] = envios.map((o) => ({
    id: o.internalId ?? o.id,
    code: o.id,
    customer: o.customer,
    phone: o.phone ?? null,
    address: o.address ?? null,
    date: o.date,
    total: o.total,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty })),
    mapUrl: o.lat != null && o.lng != null ? googleMapsPointUrl({ lat: o.lat, lng: o.lng }) : null,
    lat: o.lat ?? null,
    lng: o.lng ?? null,
    franjaHoraria: deliveryEstimateLabel(o.deliverySlot, o.deliveryDate),
    slotId: o.deliverySlot ?? null,
    deliveryDate: o.deliveryDate ?? null,
    isRetry: o.status === "cancelado",
  }));

  // Cada cierre es un bloque independiente, incluso si sale el mismo repartidor.
  const routeKey = (o: Order) =>
    o.routeBatchId ?? `legacy:${o.repartidorId ?? "sin-asignar"}:${o.dispatchedAt ?? ""}`;
  const rutaActivas: (RutaEnCursoProps & { repartidorId: string })[] = [
    ...new Set(ruta.map(routeKey)),
  ].map((key) => {
    const pedidos = ruta.filter((o) => routeKey(o) === key);
    const originSucursal = sucursales.find((s) => s.id === pedidos[0]?.originSucursalId);
    const routePoints = pedidos
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({ lat: o.lat as number, lng: o.lng as number }));
    const stops: RutaStop[] = pedidos.map((o) => ({
      id: o.internalId ?? o.id,
      code: o.id,
      routeSeq: o.routeSeq ?? null,
      customer: o.customer,
      phone: o.phone ?? null,
      address: o.address ?? null,
      deliveryCode: o.deliveryCode ?? null,
      status: o.status,
      mapUrl:
        o.lat != null && o.lng != null ? googleMapsPointUrl({ lat: o.lat, lng: o.lng }) : null,
      deliveredAt: o.status === "entregado" ? o.deliveredAt ?? o.updatedAt ?? null : null,
      repartidor: staffName(o.repartidorId),
    }));
    return {
      routeKey: key,
      batchId: key,
      repartidorId: pedidos[0]?.repartidorId ?? "sin-asignar",
      repartidor: staffName(pedidos[0]?.repartidorId) ?? "Sin asignar",
      dispatchedAt: pedidos[0]?.dispatchedAt ?? null,
      stops,
      originName: originSucursal?.name ?? "la sucursal",
      routeMapUrl:
        routePoints.length > 0
          ? googleMapsRouteUrl(
              originSucursal
                ? { lat: originSucursal.lat, lng: originSucursal.lng }
                : DEFAULT_ROUTE_ORIGIN,
              routePoints
            )
          : null,
    };
  });

  // Una tarjeta por repartidor (aunque tenga varios lotes en la calle), para que
  // la pantalla no sea un choclo de rutas abiertas.
  const repartidoresActivos: RepartidorActivo[] = [];
  for (const activa of rutaActivas) {
    const actual = repartidoresActivos.find((r) => r.id === activa.repartidorId);
    if (actual) actual.rutas.push(activa);
    else
      repartidoresActivos.push({
        id: activa.repartidorId,
        name: activa.repartidor,
        rutas: [activa],
      });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Entregas</h1>
        <p className="text-sm text-brand-ink/55">
          Pedidos pagados listos para salir a reparto.
        </p>
      </div>

      {/* Repartidores con rutas activas: tarjetas plegadas, se abre la del que se elige */}
      <RepartidoresActivos repartidores={repartidoresActivos} />

      <div className="flex justify-end">
        <a
          href="#historial-rutas"
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-black/5"
        >
          Ver historial de rutas y pedidos
        </a>
      </div>

      {/* Cierre de pedidos: selección + control de stock + ruta optimizada */}
      <EntregasClient
        sucursales={sucursalOptions}
        repartidores={repartidores}
        envios={enviosPendientes}
        enCurso={enCamino.length}
      />

      <HistorialRutas
        rutas={historial}
        staffName={staffName}
        sucursalName={sucursalName}
      />
    </div>
  );
}
