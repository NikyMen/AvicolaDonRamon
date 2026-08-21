import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  aiHabilitado,
  askBusinessDeepSeek,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
} from "@/lib/ai";
import { getSession } from "@/lib/auth/session";
import { sessionHasPerm } from "@/lib/auth/permissions";

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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!sessionHasPerm(session, "reportes")) {
    return NextResponse.json({ error: "No tenés permiso para usar reportes." }, { status: 403 });
  }
  if (!aiHabilitado()) {
    return NextResponse.json(
      { error: "La IA no está disponible: falta configurar la clave del proveedor." },
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
    return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });
  }

  try {
    const reply = await askBusinessDeepSeek(parsed.data.messages);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[admin/ai/reportes]", error);
    return NextResponse.json(
      { error: "No pude completar el análisis. Probá nuevamente en un momento." },
      { status: 502 }
    );
  }
}
