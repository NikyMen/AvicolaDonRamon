import type { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api/auth";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getCustomer } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await ctx.params;
    const customer = await getCustomer(id);
    if (!customer) return fail("Cliente no encontrado.", 404, "NOT_FOUND");
    return ok(customer);
  } catch (e) {
    return handleError(e);
  }
}
