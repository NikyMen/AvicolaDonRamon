import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearPreferencia, mpHabilitado } from "@/lib/mercadopago";
import {
  createOrder,
  deletePendingOrder,
  quoteOrder,
  getProduct,
  saveMercadoPagoPreference,
  applyVerifiedMercadoPagoPayment,
  CouponError,
  NoDatabaseError,
  OutOfStockError,
} from "@/lib/repo";
import { hasDatabase } from "@/lib/prisma";
import { isInsideCorrientes, MIN_ENVIO_TOTAL } from "@/lib/geo";
import {
  DELIVERY_SLOTS,
  deliveryEstimateLabel,
  estimatedDeliveryOptions,
} from "@/lib/entrega";
import { isValidPhone } from "@/lib/phone";
import { formatARS } from "@/lib/format";

// Prisma + Mercado Pago necesitan el runtime Node (no Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  checkoutId: z.string().uuid("No pudimos identificar este intento de pago."),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
        // name/price los manda el carrito; solo se usan como respaldo en el
        // modo sandbox (sin base de datos). Con DB manda el catálogo.
        name: z.string().optional(),
        price: z.number().optional(),
      })
    )
    .min(1),
  direccion: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  franjaHoraria: z.enum(DELIVERY_SLOTS.map((s) => s.id) as [string, ...string[]], {
    message: "Elegí el rango horario en el que querés recibir el pedido.",
  }),
  fechaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de entrega no es válida."),
  nombre: z.string().trim().min(2, "Decinos tu nombre."),
  telefono: z
    .string()
    .trim()
    .min(6, "Dejanos un WhatsApp de contacto.")
    // El teléfono identifica al cliente: si es inválido, la compra no se puede
    // asociar. Se valida sobre el número normalizado (sin 0, 15, +54…).
    .refine(isValidPhone, "Revisá el número de WhatsApp."),
  couponCode: z.string().trim().min(3).optional(),
});

/**
 * Cotiza cuando no hay base de datos (modo sandbox local). Usa el producto de
 * ejemplo si existe y, si no, confía en el nombre/precio que mandó el carrito.
 * Así la prueba de Mercado Pago funciona con cualquier producto. En producción
 * SIEMPRE hay DB y se usa `quoteOrder` (precios autoritativos del catálogo).
 */
async function quoteFromMocks(
  items: { productId: string; qty: number; name?: string; price?: number }[]
) {
  const lines = [];
  for (const i of items) {
    const p = await getProduct(i.productId);
    const name = p?.name ?? i.name;
    const price = p?.price ?? i.price;
    if (!name || !Number.isFinite(price) || (price as number) <= 0) {
      throw new Error(`Datos inválidos del producto: ${i.productId}`);
    }
    if (p && (!p.available || p.stock <= 0)) {
      throw new OutOfStockError(name, 0);
    }
    if (p && p.stock < i.qty) {
      throw new OutOfStockError(name, p.stock);
    }
    lines.push({ productId: i.productId, name, qty: i.qty, price: price as number });
  }
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  return { lines, total };
}

/** Deduce la URL pública del sitio para armar back_urls/notification_url. */
function baseDelSitio(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Modo demo: si `CHECKOUT_FAKE_PAYMENT` está activo, el botón de Mercado Pago
 * no redirige a MP: crea el pedido, lo marca como pagado (en_preparacion) y
 * vuelve directo a la pantalla de resultado. Sirve para recorrer todo el flujo
 * (pedido → reparto → entregado) en pruebas, sin pasar por el checkout real.
 */
function pagoSimulado(): boolean {
  const v = process.env.CHECKOUT_FAKE_PAYMENT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

export async function POST(req: NextRequest) {
  const fake = pagoSimulado();
  if (!fake && !mpHabilitado()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor." },
      { status: 503 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos incompletos.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = parsed.data;

  // Validación de la entrega (siempre a domicilio). Nada de esto se confía
  // del navegador: se revalida todo acá.
  const direccion = body.direccion?.trim() ?? "";
  if (direccion.length < 4) {
    return NextResponse.json(
      { error: "Completá la dirección de entrega (calle y altura)." },
      { status: 400 }
    );
  }
  if (body.lat === undefined || body.lng === undefined) {
    return NextResponse.json(
      { error: "Marcá y confirmá el punto de entrega en el mapa." },
      { status: 400 }
    );
  }
  if (!isInsideCorrientes(body.lat, body.lng)) {
    return NextResponse.json(
      { error: "Por el momento solo hacemos envíos dentro de la ciudad de Corrientes." },
      { status: 400 }
    );
  }
  const address = direccion;
  // El servidor vuelve a calcular la fecha con hora Argentina. Así un reloj
  // incorrecto o una pestaña abierta durante el corte no agenda un día viejo.
  const entregaValida = estimatedDeliveryOptions().some(
    (opcion) =>
      opcion.id === body.franjaHoraria && opcion.date === body.fechaEntrega
  );
  if (!entregaValida) {
    return NextResponse.json(
      { error: "La fecha de entrega se actualizó. Revisá y elegí nuevamente el horario." },
      { status: 409 }
    );
  }
  const franjaLabel = deliveryEstimateLabel(body.franjaHoraria, body.fechaEntrega);

  try {
    // Precios reales del catálogo + validación del mínimo de compra.
    // Sin base de datos (dev/sandbox) se cotiza contra los datos de ejemplo.
    const { total } = hasDatabase
      ? await quoteOrder(body.items)
      : await quoteFromMocks(body.items);
    if (total < MIN_ENVIO_TOTAL) {
      return NextResponse.json(
        {
          error: `La compra mínima es de ${formatARS(MIN_ENVIO_TOTAL)}. Sumá productos para completar tu pedido.`,
        },
        { status: 400 }
      );
    }

    // 1) Registramos el pedido (pendiente) vinculado al cliente. Con base de
    //    datos se persiste en Postgres; sin base (demo local) queda en memoria.
    const orderInput = {
      checkoutId: body.checkoutId,
      customer: { name: body.nombre, phone: body.telefono },
      items: body.items,
      payment: "mercadopago",
      address,
      entrega: "envio",
      deliverySlot: body.franjaHoraria,
      deliveryDate: body.fechaEntrega,
      lat: body.lat,
      lng: body.lng,
      couponCode: body.couponCode,
      notes:
        `Pedido web · Mercado Pago · Entrega ${franjaLabel}\n` +
        `Mapa: https://www.google.com/maps?q=${body.lat},${body.lng}`,
    } as const;
    let order = await createOrder(orderInput);

    // Un reintento posterior al minuto descarta el checkout vencido y genera
    // una reserva/preferencia nuevas con la misma clave idempotente.
    if (
      order.status === "pendiente" &&
      order.couponReservedUntil &&
      new Date(order.couponReservedUntil).getTime() <= Date.now()
    ) {
      await deletePendingOrder(order.internalId ?? order.id);
      order = await createOrder(orderInput);
    }
    if (order.status === "no_pagado") {
      return NextResponse.json(
        {
          error: "El intento anterior no se pagó. Volvé a intentar para generar uno nuevo.",
          resetCheckout: true,
        },
        { status: 409 }
      );
    }
    const externalReference = order.internalId ?? order.id;
    const orderId = order.id;

    // Modo demo: marcamos el pago como aprobado y volvemos directo a la
    // pantalla de resultado, sin pasar por el checkout real de Mercado Pago.
    if (fake) {
      await applyVerifiedMercadoPagoPayment(externalReference, {
        id: `demo-${externalReference}`,
        status: "approved",
      });
      const url = `/checkout/resultado?status=approved&external_reference=${encodeURIComponent(
        externalReference
      )}&demo=1`;
      return NextResponse.json({ url, orderId, demo: true });
    }

    // Una respuesta perdida no obliga a crear otra preferencia ni otro pedido.
    if (order.mpInitPoint && order.mpPreferenceId) {
      return NextResponse.json({
        url: order.mpInitPoint,
        orderId,
        preferenceId: order.mpPreferenceId,
        reused: true,
      });
    }

    // 2) Creamos la preferencia de Checkout Pro vinculada al pedido.
    let pref: Awaited<ReturnType<typeof crearPreferencia>>;
    try {
      pref = await crearPreferencia({
        externalReference,
        baseUrl: baseDelSitio(req),
        expiresAt: order.couponReservedUntil
          ? new Date(order.couponReservedUntil)
          : undefined,
        items: [{
          id: orderId,
          title: body.couponCode ? `Pedido web · Cupón ${body.couponCode.toUpperCase()}` : "Pedido web",
          quantity: 1,
          unit_price: order.total,
        }],
      });
    } catch (error) {
      await deletePendingOrder(externalReference).catch((rollbackError) => {
        console.error(`[checkout] no se pudo revertir ${order.id}:`, rollbackError);
      });
      console.error(`[checkout] Mercado Pago rechazó la preferencia de ${order.id}:`, error);
      throw error;
    }

    const url = pref.init_point || pref.sandbox_init_point;
    if (!url) {
      await deletePendingOrder(externalReference);
      console.error(`[checkout] Mercado Pago devolvió una preferencia sin URL para ${order.id}.`);
      return NextResponse.json(
        { error: "Mercado Pago no devolvió una URL de pago." },
        { status: 502 }
      );
    }

    const saved = await saveMercadoPagoPreference(externalReference, {
      id: pref.id,
      initPoint: url,
    });
    return NextResponse.json({
      url: saved?.mpInitPoint ?? url,
      orderId,
      preferenceId: saved?.mpPreferenceId ?? pref.id,
    });
  } catch (e) {
    if (e instanceof NoDatabaseError) {
      return NextResponse.json(
        { error: "El pago online no está disponible en este momento." },
        { status: 503 }
      );
    }
    console.error("[checkout] no se pudo iniciar el pago:", e);
    const msg = e instanceof Error ? e.message : "Error desconocido.";
    return NextResponse.json(
      { error: `No pudimos iniciar el pago. ${msg}` },
      { status: 502 }
    );
  }
}
