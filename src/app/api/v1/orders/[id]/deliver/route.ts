import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import { confirmDelivery } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  /** Código de 4 dígitos que el cliente le dio al repartidor. */
  code: z.string().trim().min(1),
});

/**
 * POST /api/v1/orders/:id/deliver { code }
 * Confirma la entrega de un pedido validando el código del cliente.
 * Si el código es correcto el pedido pasa a "entregado" y se dispara el
 * webhook de n8n (evento pedido_entregado) que avisa al siguiente cliente
 * de la ruta del repartidor.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await ctx.params;
    const { code } = bodySchema.parse(await req.json());
    const result = await confirmDelivery(decodeURIComponent(id), code);

    if (result.ok) return ok(result.order);

    switch (result.reason) {
      case "not_found":
        return fail("Pedido no encontrado.", 404, "NOT_FOUND");
      case "already_delivered":
        return fail("El pedido ya estaba marcado como entregado.", 409, "ALREADY_DELIVERED");
      case "no_code":
        return fail("Este pedido no tiene código de entrega (no es un envío).", 400, "NO_CODE");
      case "invalid_code":
        return fail("Código de entrega incorrecto.", 400, "INVALID_CODE");
    }
  } catch (e) {
    return handleError(e);
  }
}
