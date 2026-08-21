import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session } from "./session";
import { hasPermission } from "./perm-modules";

export { ALL_PERMS, PERM_MODULES, PERM_KEYS, hasPermission } from "./perm-modules";
export type { PermModule } from "./perm-modules";

/** ¿La sesión actual tiene permiso para el módulo `key`? */
export function sessionHasPerm(session: Session | null, key: string): boolean {
  if (!session || session.role !== "admin") return false;
  return hasPermission(session.perms, key);
}

/**
 * Guard para Server Actions: devuelve un mensaje de error si la sesión no
 * tiene permiso para `key`, o `null` si está habilitada.
 */
export async function assertPerm(key: string): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== "admin") return "No autorizado.";
  return sessionHasPerm(session, key) ? null : "No tenés permiso para esta acción.";
}

/**
 * Guard para páginas (Server Components): redirige al login si no hay sesión
 * de panel, o al dashboard si la sesión no tiene permiso para `key`.
 */
export async function requirePerm(key: string): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect(`/admin/login?next=/admin/${key}`);
  if (!sessionHasPerm(session, key)) redirect(`/admin?denied=${key}`);
}
