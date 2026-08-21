import { NextResponse } from "next/server";
import { getRepartoAccess } from "@/lib/auth/reparto-access";
import { listActiveRoute } from "@/lib/repo";
import { googleMapsPointUrl, googleMapsRouteUrl, DEFAULT_ROUTE_ORIGIN } from "@/lib/route";
import { sucursales } from "@/lib/sucursales";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/reparto/ruta
 * Ruta del reparto en curso para la página móvil del repartidor. Requiere
 * sesión: un repartidor ve SOLO sus entregas asignadas; el panel (permiso
 * entregas) ve todo. NO expone el código de entrega (lo dice el cliente al
 * recibir el pedido). El "próximo" es el primer pedido que sigue en camino.
 */
export async function GET() {
  const access = await getRepartoAccess();
  if (!access) {
    return NextResponse.json(
      { error: "Iniciá sesión con tu usuario para ver tu ruta." },
      { status: 401 }
    );
  }

  const route = await listActiveRoute(access.kind === "repartidor" ? access.id : undefined);
  const nextId = route.find((o) => o.status === "en_camino")?.internalId ?? null;

  const stops = route.map((o) => ({
    id: o.internalId,
    code: o.id,
    routeSeq: o.routeSeq ?? null,
    customer: o.customer,
    phone: o.phone ?? null,
    address: o.address ?? null,
    status: o.status,
    isNext: (o.internalId ?? null) === nextId,
    deliveredAt: o.status === "entregado" ? o.updatedAt ?? null : null,
    mapUrl: o.lat != null && o.lng != null ? googleMapsPointUrl({ lat: o.lat, lng: o.lng }) : null,
  }));

  // Ruta completa en Google Maps: origen = sucursal de salida del lote.
  const originId = route[0]?.originSucursalId;
  const sucursal = sucursales.find((s) => s.id === originId);
  const origin = sucursal ? { lat: sucursal.lat, lng: sucursal.lng } : DEFAULT_ROUTE_ORIGIN;
  const points = route
    .filter((o) => o.lat != null && o.lng != null)
    .map((o) => ({ lat: o.lat as number, lng: o.lng as number }));
  const routeMapUrl = points.length > 0 ? googleMapsRouteUrl(origin, points) : null;

  const pendientes = route.filter((o) => o.status === "en_camino").length;
  const entregados = route.filter((o) => o.status === "entregado").length;
  return NextResponse.json({
    stops,
    pendientes,
    entregados,
    total: route.length,
    routeMapUrl,
    /** Nombre del repartidor logueado (null si mira el panel). */
    repartidor: access.kind === "repartidor" ? access.name : null,
  });
}
