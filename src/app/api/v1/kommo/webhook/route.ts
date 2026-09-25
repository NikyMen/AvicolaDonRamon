import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, handleError, ok } from "@/lib/api/respond";
import { parseKommoContactWebhook } from "@/lib/commercial-condition";
import { applyKommoCommercialConditions } from "@/lib/whatsapp-assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook de Kommo (Ajustes → Integraciones → Webhooks, evento "Contacto
 * modificado"). Kommo no permite encabezados propios, por eso el secreto
 * viaja en la URL: /api/v1/kommo/webhook?secret=<KOMMO_WEBHOOK_SECRET>.
 * Solo copia el campo "Condición comercial"; no guarda nada más del contacto.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.KOMMO_WEBHOOK_SECRET?.trim();
  if (!expected) return fail("Webhook de Kommo no configurado.", 503, "KOMMO_WEBHOOK_NOT_CONFIGURED");
  if (!sameSecret(req.nextUrl.searchParams.get("secret") ?? "", expected)) {
    return fail("No autorizado.", 401, "UNAUTHORIZED");
  }

  try {
    const updates = parseKommoContactWebhook(new URLSearchParams(await req.text()), {
      fieldId: process.env.KOMMO_COMMERCIAL_CONDITION_FIELD_ID?.trim() || undefined,
    });
    const updated = updates.length > 0 ? await applyKommoCommercialConditions(updates) : 0;
    return ok({ received: updates.length, updated });
  } catch (error) {
    return handleError(error);
  }
}
