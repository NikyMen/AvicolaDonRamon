import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteAutomaticCoupon } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().positive() })).min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    return NextResponse.json(await quoteAutomaticCoupon(body.items));
  } catch {
    // Las promos automáticas no deben bloquear el carrito si no hay una regla
    // activa o si la base de datos todavía no está disponible.
    return NextResponse.json(null);
  }
}
