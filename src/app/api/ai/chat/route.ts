import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { askDeepSeek, aiHabilitado, MAX_HISTORY, MAX_MESSAGE_CHARS } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_HISTORY),
});

/**
 * Límite por IP. El endpoint es público y cada llamada le cuesta plata a la
 * pollería, así que ponemos un tope simple en memoria. Alcanza para un solo
 * contenedor; si algún día hay varias réplicas, esto hay que moverlo a Redis.
 */
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Limpieza oportunista para que el Map no crezca sin control.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocido";
}

export async function POST(req: NextRequest) {
  if (!aiHabilitado()) {
    return NextResponse.json(
      { error: "El asistente no está disponible en este momento." },
      { status: 503 }
    );
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Estás yendo muy rápido. Esperá un momento y volvé a intentar." },
      { status: 429 }
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
    return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });
  }

  try {
    const reply = await askDeepSeek(parsed.data.messages);
    return NextResponse.json({ reply });
  } catch (e) {
    // El detalle puede traer la respuesta cruda de DeepSeek: al log, no al cliente.
    console.error("[ai/chat]", e);
    return NextResponse.json(
      { error: "No pudimos responderte ahora. Probá de nuevo o escribinos por WhatsApp." },
      { status: 502 }
    );
  }
}
