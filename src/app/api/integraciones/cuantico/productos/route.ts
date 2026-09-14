import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/auth";
import { syncCuanticoProducts } from "@/lib/cuantico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json().catch(() => ({}));
    const result = await syncCuanticoProducts({ fecha: typeof body.fecha === "string" ? body.fecha : undefined });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error sincronizando productos.";
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
