import type { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api/auth";
import { ok, handleError } from "@/lib/api/respond";
import { listCategories } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    return ok(listCategories());
  } catch (e) {
    return handleError(e);
  }
}
