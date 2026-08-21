import type { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api/auth";
import { ok, handleError } from "@/lib/api/respond";
import { listProducts } from "@/lib/repo";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATEGORIES = ["cortes", "cajones", "rebozados"];

export async function GET(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const sp = req.nextUrl.searchParams;
    const categoryParam = sp.get("category") ?? undefined;
    const availableParam = sp.get("available");
    const search = sp.get("search") ?? undefined;

    const category =
      categoryParam && CATEGORIES.includes(categoryParam)
        ? (categoryParam as Category)
        : undefined;
    const available =
      availableParam === null ? undefined : availableParam === "true";

    const products = await listProducts({ category, available, search });
    return ok(products);
  } catch (e) {
    return handleError(e);
  }
}
