import { NextResponse } from "next/server";
import { getRepartoAccess } from "@/lib/auth/reparto-access";
import { listRouteHistory } from "@/lib/repo";
import { sucursales } from "@/lib/sucursales";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/reparto/historial
 * Lotes ya cerrados para la página móvil del repartidor: un repartidor ve SOLO
 * los repartos que salieron a su nombre; el panel (permiso entregas) ve todos.
 * Igual que la ruta en curso, NO expone el código de entrega del cliente.
 */
export async function GET() {
  const access = await getRepartoAccess();
  if (!access) {
    return NextResponse.json(
      { error: "Iniciá sesión con tu usuario para ver tu historial." },
      { status: 401 }
    );
  }

  const rutas = await listRouteHistory(20, access.kind === "repartidor" ? access.id : undefined);

  const lotes = rutas.map((ruta) => ({
    batchId: ruta.batchId,
    dispatchedAt: ruta.dispatchedAt ?? null,
    closedAt: ruta.closedAt ?? null,
    origen: sucursales.find((s) => s.id === ruta.originSucursalId)?.name ?? null,
    total: ruta.orders.length,
    entregados: ruta.orders.filter((o) => o.status === "entregado").length,
    stops: ruta.orders.map((o) => ({
      code: o.id,
      routeSeq: o.routeSeq ?? null,
      customer: o.customer,
      phone: o.phone ?? null,
      address: o.address ?? null,
      status: o.status,
      deliveredAt: o.deliveredAt ?? (o.status === "entregado" ? o.updatedAt ?? null : null),
    })),
  }));

  return NextResponse.json({ lotes });
}
