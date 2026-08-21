import type { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getProduct } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await ctx.params;
    const product = await getProduct(id);
    if (!product) return fail("Producto no encontrado.", 404, "NOT_FOUND");
    return ok(product);
  } catch (e) {
    return handleError(e);
  }
}
