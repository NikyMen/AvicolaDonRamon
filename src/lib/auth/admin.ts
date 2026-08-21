import "server-only";
import crypto from "crypto";

/**
 * Credenciales únicas del panel de administración.
 *
 * Se configuran por variables de entorno:
 *   ADMIN_USER     — nombre de usuario (default en dev: "admin")
 *   ADMIN_PASSWORD — contraseña (obligatoria en producción)
 */

function adminUser(): string {
  const user = process.env.ADMIN_USER;
  if (user) return user;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_USER no está configurado.");
  }
  return "admin";
}

function adminPassword(): string {
  const p = process.env.ADMIN_PASSWORD;
  if (p && p.length > 0) return p;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD no está configurada.");
  }
  // Fallback solo para desarrollo.
  return "admin";
}

/** Comparación en tiempo constante de dos strings. */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Verifica usuario y contraseña del admin. */
export function verifyAdminCredentials(user: string, password: string): boolean {
  const okUser = safeEqual(user.trim(), adminUser());
  const okPass = safeEqual(password, adminPassword());
  return okUser && okPass;
}
