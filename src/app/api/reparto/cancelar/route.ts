import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRepartoAccess } from "@/lib/auth/reparto-access";
import { cancelDelivery, NoDatabaseError } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().trim().min(1),
});

/** POST /api/reparto/cancelar { id } */
export async function POST(req: NextRequest) {
  const access = await getRepartoAccess();
  if (!access) {
    return NextResponse.json({ error: "Iniciá sesión para cancelar un pedido." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "No encontramos el pedido." }, { status: 400 });
  }

  try {
    const result = await cancelDelivery(
      parsed.data.id,
      access.kind === "repartidor" ? access.id : undefined
    );

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        customer: result.order.customer,
        pedido: result.order.id,
      });
    }

    const messages: Record<string, string> = {
      not_found: "No encontramos el pedido.",
      not_assigned: "Ese pedido no está asignado a tu reparto.",
      not_in_progress: "Ese pedido todavía no está en camino.",
      already_delivered: "Ese pedido ya figura como entregado.",
      already_cancelled: "Ese pedido ya figura como reasignado.",
    };
    return NextResponse.json(
      { ok: false, error: messages[result.reason] ?? "No se pudo cancelar el pedido." },
      { status: 400 }
    );
  } catch (e) {
    if (e instanceof NoDatabaseError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo cancelar el pedido." },
      { status: 500 }
    );
  }
}
