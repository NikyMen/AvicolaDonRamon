import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NoDatabaseError } from "@/lib/repo";

/** Respuesta exitosa con envoltorio { data }. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/** Respuesta de error con envoltorio { error: { message, code? } }. */
export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: { message, ...(code ? { code } : {}) } }, { status });
}

/** Convierte cualquier excepción en una respuesta HTTP coherente. */
export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Datos inválidos.",
          code: "VALIDATION_ERROR",
          issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 }
    );
  }
  if (e instanceof NoDatabaseError) {
    return fail(e.message, 503, "NO_DATABASE");
  }
  if (e instanceof Error) {
    // Errores de conexión/inicialización de Prisma -> 503.
    if (e.name.startsWith("PrismaClientInitialization") || e.name.startsWith("PrismaClientRustPanic")) {
      return fail("Base de datos no disponible.", 503, "DB_UNAVAILABLE");
    }
    // Errores conocidos de Prisma (constraint, etc.) -> 409/400.
    if (e.name === "PrismaClientKnownRequestError") {
      return fail("Conflicto con un registro existente.", 409, "DB_CONFLICT");
    }
    // Errores de negocio (validaciones de dominio) -> 400.
    return fail(e.message, 400, "BAD_REQUEST");
  }
  return fail("Error interno del servidor.", 500, "INTERNAL");
}
