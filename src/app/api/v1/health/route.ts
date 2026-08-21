import { NextResponse } from "next/server";
import { hasDatabase, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Endpoint público de salud (sin auth). Útil para n8n y healthchecks de Docker.
export async function GET() {
  let db: "ok" | "down" | "not_configured" = "not_configured";
  if (hasDatabase) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "down";
    }
  }
  return NextResponse.json({
    status: "ok",
    service: "polleria-entre-rios-api",
    version: "v1",
    database: db,
    time: new Date().toISOString(),
  });
}
