import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handleError, ok } from "@/lib/api/respond";
import { importWholesaleProducts, listWholesaleProducts, wholesaleImportSchema } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lista mayorista completa. Nunca es pública: requiere la API key. */
export async function GET(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const availableOnly = req.nextUrl.searchParams.get("available") === "true";
    return ok(await listWholesaleProducts({ availableOnly }));
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Alta o actualización masiva: { "items": [{ code?, name, price, stock?, ... }] }.
 * Empareja por código o, sin código, por nombre. `stock: null` = sin control.
 */
export async function POST(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const { items } = z.object({ items: wholesaleImportSchema }).parse(await req.json());
    return ok(await importWholesaleProducts(items));
  } catch (error) {
    return handleError(error);
  }
}
