import { ok } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Devuelve la sesión actual (o null). */
export async function GET() {
  const session = await getSession();
  if (!session) return ok(null);
  return ok({ id: session.sub, name: session.name, phone: session.phone, role: session.role });
}
