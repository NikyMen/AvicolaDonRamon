import "server-only";
import type { OrderStatus } from "./types";
import { createHmac, timingSafeEqual } from "node:crypto";

// Integración con Mercado Pago (Checkout Pro). Todo este módulo corre SOLO en
// el servidor: usa el access token (secreto) para crear la preferencia de pago
// y para consultar el estado de un pago. El navegador nunca ve el token.
//
// Flujo:
//   1) crearPreferencia(...)  -> POST /checkout/preferences
//      devuelve init_point (URL del checkout) a la que redirigimos al cliente.
//   2) El cliente paga en Mercado Pago y vuelve a back_urls (/checkout/resultado).
//   3) Confirmamos el pago con obtenerPago(paymentId) -> GET /v1/payments/:id.

const MP_API = "https://api.mercadopago.com";

/** Access token de Mercado Pago (TEST-... en pruebas, APP_USR-... en prod). */
export function mpAccessToken(): string | null {
  const t = process.env.MP_ACCESS_TOKEN?.trim();
  return t ? t : null;
}

/** ¿Hay credenciales configuradas? Si no, el botón de MP no se ofrece. */
export function mpHabilitado(): boolean {
  return mpAccessToken() !== null;
}

/** Una URL pública (no localhost) puede recibir auto_return y webhooks de MP. */
function esHostPublico(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    const h = u.hostname;
    if (h === "localhost" || h === "::1") return false;
    if (h.startsWith("127.") || h.startsWith("0.0.0.0")) return false;
    // IPs/hostnames de red interna tampoco son alcanzables por MP.
    if (h.startsWith("192.168.") || h.startsWith("10.")) return false;
    return true;
  } catch {
    return false;
  }
}

async function mpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = mpAccessToken();
  if (!token) throw new Error("MP_ACCESS_TOKEN no configurado");
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detalle = (data && (data.message || data.error)) || res.statusText || "error";
    throw new Error(`Mercado Pago ${res.status}: ${detalle}`);
  }
  return data as T;
}

export type MpItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

export type CrearPreferenciaInput = {
  items: MpItem[];
  /** Referencia para vincular el pago con nuestro pedido (id de la Order). */
  externalReference: string;
  /** Base pública del sitio (ej. https://polleria.com o http://localhost:3000). */
  baseUrl: string;
  /** Email del comprador (opcional; el checkout igual lo pide). */
  payerEmail?: string;
  /** Vencimiento del checkout, usado para respetar la reserva del cupón. */
  expiresAt?: Date;
};

export type MpPreferencia = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

export async function crearPreferencia(
  input: CrearPreferenciaInput
): Promise<MpPreferencia> {
  const base = input.baseUrl.replace(/\/$/, "");
  const retorno = `${base}/checkout/resultado`;
  const publico = esHostPublico(base);

  const body: Record<string, unknown> = {
    items: input.items.map((it) => ({
      id: it.id,
      title: it.title.slice(0, 250),
      quantity: it.quantity,
      unit_price: it.unit_price,
      currency_id: it.currency_id ?? "ARS",
    })),
    external_reference: input.externalReference,
    back_urls: {
      success: retorno,
      failure: retorno,
      pending: retorno,
    },
    statement_descriptor: "POLLERIA ENTRERIOS",
    binary_mode: false,
  };

  if (input.payerEmail) {
    body.payer = { email: input.payerEmail };
  }

  if (input.expiresAt) {
    const now = new Date();
    if (input.expiresAt.getTime() <= now.getTime()) {
      throw new Error("La reserva del cupón venció. Volvé a intentar el pago.");
    }
    body.expires = true;
    body.expiration_date_from = new Date(now.getTime() - 5_000).toISOString();
    body.expiration_date_to = input.expiresAt.toISOString();
  }

  // auto_return y notification_url solo valen para URLs públicas. En localhost
  // Mercado Pago rechaza auto_return y nunca podría llamar al webhook.
  if (publico) {
    body.auto_return = "approved";
    body.notification_url = `${base}/api/checkout/mercadopago/webhook`;
  }

  return mpFetch<MpPreferencia>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type MpPago = {
  id: number;
  /** approved | pending | in_process | rejected | cancelled | refunded ... */
  status: string;
  status_detail: string;
  external_reference?: string | null;
  transaction_amount?: number;
};

/** Consulta un pago y propaga el error para que el webhook pueda pedir reintento. */
export async function obtenerPagoEstricto(paymentId: string): Promise<MpPago> {
  return mpFetch<MpPago>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

/** Consulta un pago por id. Devuelve null si no existe o falla. */
export async function obtenerPago(paymentId: string): Promise<MpPago | null> {
  try {
    return await obtenerPagoEstricto(paymentId);
  } catch {
    return null;
  }
}

/**
 * Valida la firma HMAC documentada por Mercado Pago. Si todavía no se
 * configuró MP_WEBHOOK_SECRET se mantiene compatibilidad y la autenticidad se
 * apoya en la consulta server-to-server del pago.
 */
export function validarFirmaWebhook(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!input.signature || !input.requestId || !input.dataId) return false;

  const parts = Object.fromEntries(
    input.signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    })
  );
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/** Traduce el estado de un pago de MP al estado interno del pedido. */
export function estadoPedidoDesdePago(mpStatus: string | null | undefined): OrderStatus {
  switch (mpStatus) {
    case "approved":
      return "en_preparacion";
    case "rejected":
    case "cancelled":
      return "no_pagado";
    case "refunded":
    case "charged_back":
      return "cancelado";
    default:
      // pending, in_process, etc.
      return "pendiente";
  }
}
