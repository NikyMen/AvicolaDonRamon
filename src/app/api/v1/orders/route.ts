import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { ok, handleError } from "@/lib/api/respond";
import { listOrders, createOrder } from "@/lib/repo";
import { DELIVERY_SLOTS } from "@/lib/entrega";
import { isValidPhone } from "@/lib/phone";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: OrderStatus[] = [
  "pendiente",
  "no_pagado",
  "en_preparacion",
  "en_camino",
  "entregado",
  "cancelado",
];

const createOrderSchema = z.object({
  customerId: z.string().min(1).optional(),
  customer: z
    .object({
      name: z.string().min(1, "El nombre es obligatorio."),
      phone: z
        .string()
        .min(5, "El teléfono es obligatorio.")
        .refine(isValidPhone, "Teléfono inválido."),
      email: z.string().email().optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
      })
    )
    .min(1, "El pedido debe tener al menos un producto."),
  payment: z.enum(["efectivo", "tarjeta", "mercadopago", "transferencia"]),
  address: z.string().optional(),
  notes: z.string().optional(),
  /** Rango horario de entrega ("08-12" o "17-20"). */
  deliverySlot: z
    .enum(DELIVERY_SLOTS.map((s) => s.id) as [string, ...string[]])
    .optional(),
  /** Fecha calendario estimada de entrega (YYYY-MM-DD). */
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((d) => d.customerId || d.customer, {
  message: "Indicá customerId o los datos del cliente (customer).",
  path: ["customer"],
});

export async function GET(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const sp = req.nextUrl.searchParams;
    const statusParam = sp.get("status");
    const status =
      statusParam && STATUSES.includes(statusParam as OrderStatus)
        ? (statusParam as OrderStatus)
        : undefined;
    const customerId = sp.get("customerId") ?? undefined;
    const limitParam = sp.get("limit");
    const limit = limitParam ? Math.min(Number(limitParam) || 0, 200) : undefined;

    return ok(await listOrders({ status, customerId, limit }));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json();
    const input = createOrderSchema.parse(body);
    const order = await createOrder(input);
    return ok(order, 201);
  } catch (e) {
    return handleError(e);
  }
}
