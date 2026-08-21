import { NextResponse } from "next/server";
import { z } from "zod";
import { CouponError, quoteCoupon } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(3),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().positive() })).min(1),
  // Necesario para los códigos de bienvenida: valen una vez por número.
  telefono: z.string().trim().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    return NextResponse.json(await quoteCoupon(body.code, body.items, body.telefono));
  } catch (e) {
    const message = e instanceof CouponError ? e.message : "No se pudo validar el cupón.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
