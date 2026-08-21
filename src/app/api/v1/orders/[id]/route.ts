import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getOrder, updateOrderStatus } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum([
    "pendiente",
    "no_pagado",
    "en_preparacion",
    "en_camino",
    "entregado",
    "cancelado",
  ]),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await ctx.params;
    const order = await getOrder(decodeURIComponent(id));
    if (!order) return fail("Pedido no encontrado.", 404, "NOT_FOUND");
    return ok(order);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await ctx.params;
    const { status } = patchSchema.parse(await req.json());
    const order = await updateOrderStatus(decodeURIComponent(id), status);
    if (!order) return fail("Pedido no encontrado.", 404, "NOT_FOUND");
    return ok(order);
  } catch (e) {
    return handleError(e);
  }
}
