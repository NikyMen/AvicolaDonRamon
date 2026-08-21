import type { Order, OrderStatus } from "./types";
import { deliveryEstimateLabel } from "./entrega";

/**
 * Avisos de pedidos hacia n8n. Cada vez que un pedido cambia de estado se
 * dispara un POST al webhook configurado en N8N_ORDER_WEBHOOK_URL con el
 * evento y el pedido completo (teléfono, dirección, punto del mapa, código
 * de entrega, etc.). Desde ese flujo n8n manda los WhatsApp al cliente:
 *
 *   pedido_confirmado → "Recibimos tu pago, estamos preparando tu pedido."
 *   pedido_en_camino  → código de entrega y aviso de que debe entregarse al
 *                       repartidor al recibir el pedido (a todo el lote al despachar)
 *   pedido_entregado  → confirmación de entrega recibida.
 *   pedido_cancelado  → aviso de cancelación.
 *
 * Si la variable no está configurada, no se envía nada (no rompe el flujo).
 */

export type OrderEvent =
  | "pedido_creado"
  | "pedido_confirmado"
  | "pedido_en_camino"
  | "pedido_entregado"
  | "pedido_cancelado";

const DELIVERY_CANCEL_WEBHOOK_URL =
  "https://n8n.srv1224751.hstgr.cloud/webhook/pollerianoentregado";
const ORDER_DELIVERED_WEBHOOK_URL =
  "https://n8n.srv1224751.hstgr.cloud/webhook/pedido-entregado";

/** Traduce un estado del pedido al evento que le avisamos a n8n. */
export function eventForStatus(status: OrderStatus): OrderEvent | null {
  switch (status) {
    case "en_preparacion":
      return "pedido_confirmado";
    case "en_camino":
      return "pedido_en_camino";
    case "entregado":
      return "pedido_entregado";
    case "cancelado":
      return "pedido_cancelado";
    default:
      return null;
  }
}

function messageForOrderEvent(event: OrderEvent, order: Order): string {
  switch (event) {
    case "pedido_confirmado":
      return `✅ Recibimos tu pedido ${order.id}. Ya estamos preparándolo.${
        deliveryEstimateLabel(order.deliverySlot, order.deliveryDate)
          ? `\n📅 Entrega estimada: ${deliveryEstimateLabel(order.deliverySlot, order.deliveryDate)}.`
          : ""
      }`;
    case "pedido_en_camino":
      return `🚚 Tu pedido está saliendo de la sucursal.\n🔐 Este es tu código: ${order.deliveryCode ?? ""}. Debés dárselo al repartidor cuando te entregue tu pedido.`;
    case "pedido_entregado":
      return `🙌 Tu pedido ${order.id} fue entregado. ¡Gracias por tu compra!`;
    case "pedido_cancelado":
      return `❌ Tu pedido ${order.id} fue cancelado. Escribinos si necesitás ayuda.`;
    default:
      return `Recibimos una actualización de tu pedido ${order.id}.`;
  }
}

/**
 * Notifica un evento de pedido a n8n. Nunca lanza: si el webhook falla se
 * loguea y la operación original (cambio de estado, alta) sigue adelante.
 */
export async function notifyOrderEvent(event: OrderEvent, order: Order): Promise<void> {
  const url =
    event === "pedido_en_camino"
      ? process.env.N8N_ORDER_DISPATCH_WEBHOOK_URL?.trim() ||
        process.env.N8N_ORDER_WEBHOOK_URL?.trim()
      : event === "pedido_entregado"
        ? process.env.N8N_ORDER_DELIVERED_WEBHOOK_URL?.trim() ||
          ORDER_DELIVERED_WEBHOOK_URL
      : process.env.N8N_ORDER_WEBHOOK_URL?.trim();
  if (!url) return;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.N8N_ORDER_WEBHOOK_SECRET?.trim();
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const message = messageForOrderEvent(event, order);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        event,
        at: new Date().toISOString(),
        message,
        mensaje: message,
        order,
      }),
    });
    const responseBody = await res.text().catch(() => "");
    if (!res.ok) {
      console.error(`[n8n] respuesta para ${event} ${order.id}: ${responseBody.slice(0, 300)}`);
      console.error(`[n8n] webhook de pedidos respondió ${res.status} para ${event} ${order.id}`);
    }
  } catch (e) {
    console.error(`[n8n] no se pudo notificar ${event} de ${order.id}:`, e);
  }
}

/** Avisa que una entrega volvió a la lista para asignarla a otro repartidor. */
export async function notifyDeliveryReassignment(order: Order): Promise<void> {
  const url =
    process.env.N8N_DELIVERY_CANCEL_WEBHOOK_URL?.trim() || DELIVERY_CANCEL_WEBHOOK_URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret =
    process.env.N8N_DELIVERY_CANCEL_WEBHOOK_SECRET?.trim() ||
    process.env.N8N_ORDER_WEBHOOK_SECRET?.trim();
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const message =
    "Tu pedido fue reasignado. Disculpe las molestias. Nuestro equipo ya se comunicará con usted.";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        event: "pedido_reasignado",
        message,
        mensaje: message,
        at: new Date().toISOString(),
        order,
      }),
    });
    if (!res.ok) {
      console.error(`[n8n] webhook de reasignación respondió ${res.status} para ${order.id}`);
    }
  } catch (e) {
    console.error(`[n8n] no se pudo notificar la reasignación de ${order.id}:`, e);
  }
}
