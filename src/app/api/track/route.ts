import { NextRequest, NextResponse } from "next/server";
import { recordEvent, recordPresence, type AnalyticsEventType } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const TYPES: AnalyticsEventType[] = ["visit", "cart_add"];

/**
 * Endpoint público de analítica de la tienda.
 * Body: { type: "visit" | "cart_add" | "presence", productId?, path?, sessionId? }
 */
export async function POST(req: NextRequest) {
  let body: { type?: string; productId?: string; path?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (body.type === "presence") {
    if (
      typeof body.sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.sessionId
      )
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    try {
      await recordPresence(
        body.sessionId,
        typeof body.path === "string" ? body.path.slice(0, 200) : null
      );
    } catch {
      // La analítica nunca debe romper la experiencia del cliente.
    }
    return NextResponse.json({ ok: true });
  }

  if (!TYPES.includes(body.type as AnalyticsEventType)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await recordEvent({
      type: body.type as AnalyticsEventType,
      productId: typeof body.productId === "string" ? body.productId.slice(0, 100) : null,
      path: typeof body.path === "string" ? body.path.slice(0, 200) : null,
    });
  } catch {
    // La analítica nunca debe romper la experiencia del cliente.
  }
  return NextResponse.json({ ok: true });
}
