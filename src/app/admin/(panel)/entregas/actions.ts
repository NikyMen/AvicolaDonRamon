"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import {
  cancelDelivery,
  closeDeliveryRoute,
  confirmDeliveryByCode,
  DeliveryDispatchConflictError,
  dispatchDeliveries,
  getStaff,
  NoDatabaseError,
} from "@/lib/repo";
import { sucursales } from "@/lib/sucursales";

export interface CerrarPedidosState {
  ok?: boolean;
  error?: string;
  /** Cantidad de envíos despachados. */
  count?: number;
  /** URL de Google Maps con la ruta optimizada. */
  mapsUrl?: string;
}

/**
 * "Cerrar pedidos para enviar": despacha los envíos pagados seleccionados,
 * armando la ruta optimizada desde la sucursal elegida y asignándole el
 * reparto a un repartidor del equipo. Los pedidos pasan a "en camino" y se
 * disparan los avisos de WhatsApp (vía n8n).
 */
export async function cerrarPedidosEnvio(
  sucursalId: string,
  orderIds: string[],
  repartidorId: string
): Promise<CerrarPedidosState> {
  const denied = await assertPerm("entregas");
  if (denied) return { error: denied };

  if (!sucursales.some((s) => s.id === sucursalId)) {
    return { error: "Elegí la sucursal desde la que sale el reparto." };
  }
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { error: "Seleccioná al menos un pedido para la ruta." };
  }

  const repartidor = repartidorId ? await getStaff(repartidorId) : null;
  if (!repartidor || repartidor.role !== "repartidor" || !repartidor.active) {
    return { error: "Elegí el repartidor que sale con este reparto." };
  }

  try {
    const result = await dispatchDeliveries(sucursalId, orderIds, repartidor.id);
    if (result.count === 0) {
      return { error: "No hay envíos pagados listos para despachar." };
    }
    revalidatePath("/admin/entregas");
    revalidatePath("/admin/envios");
    revalidatePath("/admin/pedidos");
    return { ok: true, count: result.count, mapsUrl: result.mapsUrl };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    if (e instanceof DeliveryDispatchConflictError) return { error: e.message };
    console.error("[entregas] no se pudo cerrar el lote:", e);
    return { error: "No se pudieron cerrar los pedidos." };
  }
}

export interface ConfirmarEntregaState {
  ok?: boolean;
  error?: string;
  /** Cliente al que se le confirmó la entrega. */
  customer?: string;
  /** Código del pedido entregado (#1234). */
  pedido?: string;
}

/**
 * Marca una entrega como realizada desde el panel, ingresando el código de 4
 * dígitos que el cliente le dio al repartidor. Busca entre los envíos en camino
 * el que coincida y lo pasa a "entregado" (avisa al siguiente por WhatsApp).
 */
export async function confirmarEntrega(code: string): Promise<ConfirmarEntregaState> {
  const denied = await assertPerm("entregas");
  if (denied) return { error: denied };

  const trimmed = code.trim();
  if (!trimmed) return { error: "Ingresá el código del cliente." };

  let result;
  try {
    result = await confirmDeliveryByCode(trimmed);
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo confirmar la entrega." };
  }

  if (result.ok) {
    revalidatePath("/admin/entregas");
    revalidatePath("/admin/envios");
    revalidatePath("/admin/pedidos");
    return { ok: true, customer: result.order.customer, pedido: result.order.id };
  }

  const messages: Record<string, string> = {
    invalid_code: "No hay ningún envío en camino con ese código.",
    already_delivered: "Ese pedido ya figura como entregado.",
    no_code: "Ese pedido no es un envío.",
    not_found: "No encontramos el pedido.",
  };
  return { error: messages[result.reason] ?? "No se pudo confirmar." };
}

export interface ReasignarEntregaState {
  ok?: boolean;
  error?: string;
  pedido?: string;
}

/** Devuelve una parada en camino a Entregas para asignarla a otro repartidor. */
export async function reasignarEntrega(orderId: string): Promise<ReasignarEntregaState> {
  const denied = await assertPerm("entregas");
  if (denied) return { error: denied };
  if (!orderId.trim()) return { error: "No encontramos el pedido." };

  try {
    const result = await cancelDelivery(orderId);
    if (result.ok) {
      revalidatePath("/admin/entregas");
      revalidatePath("/admin/envios");
      revalidatePath("/admin/pedidos");
      revalidatePath("/reparto");
      return { ok: true, pedido: result.order.id };
    }

    const messages: Record<string, string> = {
      not_found: "No encontramos el pedido.",
      not_in_progress: "Ese pedido ya no está en camino.",
      already_delivered: "Ese pedido ya figura como entregado.",
      already_cancelled: "Ese pedido ya figura como reasignado.",
      not_assigned: "Ese pedido no pertenece a este reparto.",
    };
    return { error: messages[result.reason] ?? "No se pudo reasignar el pedido." };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo reasignar el pedido." };
  }
}

export async function cerrarReparto(routeKey: string): Promise<{ ok?: boolean; error?: string }> {
  const denied = await assertPerm("entregas");
  if (denied) return { error: denied };
  if (!routeKey) return { error: "No encontramos el reparto." };

  try {
    const count = await closeDeliveryRoute(routeKey);
    if (count === -1) return { error: "Primero completá todas las entregas del reparto." };
    if (count === 0) return { error: "El reparto ya estaba cerrado o no existe." };
    revalidatePath("/admin/entregas");
    revalidatePath("/reparto");
    return { ok: true };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    return { error: "No se pudo cerrar el reparto." };
  }
}
