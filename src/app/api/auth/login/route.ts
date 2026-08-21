import type { NextRequest } from "next/server";
import { fail } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El login directo quedó deshabilitado: primero se pide un código por
 * `/api/auth/request-otp` y después se verifica con `/api/auth/verify-otp`.
 */
export async function POST(_req: NextRequest) {
  return fail("Pedí y verificá un código para ingresar.", 410, "OTP_REQUIRED");
}
