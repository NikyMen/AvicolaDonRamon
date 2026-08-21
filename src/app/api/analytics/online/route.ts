import { NextResponse } from "next/server";
import { countOnlineVisitors } from "@/lib/analytics";
import { getSession } from "@/lib/auth/session";
import { sessionHasPerm } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !sessionHasPerm(session, "analitica")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json({ count: await countOnlineVisitors() });
}
