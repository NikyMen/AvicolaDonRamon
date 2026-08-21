import { NextRequest, NextResponse } from "next/server";
import { obtenerPago } from "@/lib/mercadopago";
import { applyVerifiedMercadoPagoPayment, getOrder } from "@/lib/repo";
import { deliveryEstimateLabel } from "@/lib/entrega";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Confirma el resultado del pago cuando el cliente vuelve a /checkout/resultado.
// No confiamos en el status que viene en la URL: lo verificamos consultando el
// pago real en Mercado Pago y recién ahí actualizamos el estado del pedido.
// Devuelve además los códigos del pedido para mostrárselos al cliente.
export async function POST(req: NextRequest) {
  let body: { orderId?: unknown; paymentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const paymentId = String(body.paymentId ?? "").trim();

  if (!orderId) {
    return NextResponse.json({ error: "Falta orderId." }, { status: 400 });
  }

  const previo = await getOrder(orderId).catch(() => null);
  let order = previo;
  let mpStatus: string | null = null;

  if (paymentId) {
    const pago = await obtenerPago(paymentId);
    // El pago debe corresponder exactamente al pedido y al monto cotizado.
    if (
      pago &&
      previo &&
      previo.payment === "mercadopago" &&
      pago.external_reference === (previo.internalId ?? orderId) &&
      pago.transaction_amount != null &&
      Number(pago.transaction_amount) === previo.total
    ) {
      mpStatus = pago.status;
      order =
        (await applyVerifiedMercadoPagoPayment(orderId, {
          id: String(pago.id),
          status: pago.status,
        })) ?? previo;
    } else if (pago) {
      console.error(
        `[mercadopago:confirm] pago ${paymentId} no coincide con el pedido ${orderId}.`
      );
    }
  }

  return NextResponse.json({
    status: mpStatus ?? "pending",
    estado: order?.status ?? "pendiente",
    // Códigos reales del pedido, para mostrarlos en la pantalla de resultado.
    codigo: order?.id ?? null,
    deliveryCode: order?.deliveryCode ?? null,
    franjaHoraria: deliveryEstimateLabel(order?.deliverySlot, order?.deliveryDate),
    regalo: order?.items.find((i) => i.price === 0)?.name ?? null,
  });
}
