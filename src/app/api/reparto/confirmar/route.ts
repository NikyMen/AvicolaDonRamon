import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRepartoAccess } from "@/lib/auth/reparto-access";
import { confirmDeliveryByCode, NoDatabaseError } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  /** Código de 4 dígitos que el cliente le dio al repartidor. */
  code: z.string().trim().min(1),
});

/**
 * POST /api/reparto/confirmar { code }
 * El repartidor ingresa el código que le dio el cliente. Requiere sesión: un
 * repartidor solo puede confirmar entregas asignadas a él; el panel (permiso
 * entregas) puede confirmar cualquiera. Al marcar entregado se avisa al
 * siguiente cliente de la ruta que es el próximo.
 */
export async function POST(req: NextRequest) {
  const access = await getRepartoAccess();
  if (!access) {
    return NextResponse.json(
      { error: "Iniciá sesión con tu usuario para confirmar entregas." },
      { status: 401 }
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
    return NextResponse.json({ error: "Ingresá el código del cliente." }, { status: 400 });
  }

  let result;
  try {
    result = await confirmDeliveryByCode(
      parsed.data.code,
      access.kind === "repartidor" ? access.id : undefined
    );
  } catch (e) {
    if (e instanceof NoDatabaseError) {
      return NextResponse.json(
        { ok: false, error: "El reparto no está disponible en este momento." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo confirmar la entrega." },
      { status: 500 }
    );
  }

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      customer: result.order.customer,
      pedido: result.order.id,
    });
  }

  const messages: Record<string, string> = {
    invalid_code: "No hay ningún envío en camino con ese código.",
    already_delivered: "Ese pedido ya figura como entregado.",
    no_code: "Ese pedido no es un envío.",
    not_found: "No encontramos el pedido.",
  };
  return NextResponse.json(
    { ok: false, error: messages[result.reason] ?? "No se pudo confirmar." },
    { status: 400 }
  );
}
