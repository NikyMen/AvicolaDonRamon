import type { NextRequest } from "next/server";
import { fail } from "./respond";

/**
 * Valida la API key del request.
 *
 * - Si `API_KEY` está definida en el entorno, exige el header
 *   `Authorization: Bearer <API_KEY>` (también acepta `x-api-key: <API_KEY>`).
 * - Si `API_KEY` NO está definida (modo desarrollo), deja pasar.
 *
 * Devuelve `null` si la autenticación es válida, o una respuesta 401 si no.
 */
export function requireApiKey(req: NextRequest) {
  const expected = process.env.API_KEY;

  // Modo desarrollo sin clave configurada: acceso abierto. En producción
  // nunca dejamos la API expuesta por un error de configuración.
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return fail("API key no configurada en el servidor.", 503, "API_NOT_CONFIGURED");
    }
    return null;
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : undefined;
  const provided = bearer ?? req.headers.get("x-api-key") ?? undefined;

  if (!provided || provided !== expected) {
    return fail("No autorizado: API key inválida o ausente.", 401, "UNAUTHORIZED");
  }
  return null;
}
