import { ok } from "@/lib/api/respond";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cierra la sesión borrando la cookie. */
export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}
