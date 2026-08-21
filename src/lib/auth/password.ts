import "server-only";
import crypto from "crypto";

/**
 * Hash de contraseñas con scrypt + salt aleatoria, sin librerías externas
 * (en línea con la filosofía del proyecto).
 *
 * Formato almacenado: `scrypt$<salt hex>$<hash hex>`.
 */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/** Verifica una contraseña contra un hash creado por `hashPassword`. */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
