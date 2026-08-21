import "server-only";
import { getSession } from "./session";
import { sessionHasPerm } from "./permissions";
import { getStaff } from "@/lib/repo";

/**
 * Quién está mirando el reparto:
 * - `repartidor`: empleado del equipo con rol repartidor. Ve y confirma SOLO
 *   las entregas asignadas a él (blindaje entre repartidores).
 * - `admin`: sesión del panel con permiso de entregas (o super-admin). Ve todo.
 * - `null`: sin acceso (pide iniciar sesión).
 */
export type RepartoAccess =
  | { kind: "admin" }
  | { kind: "repartidor"; id: string; name: string }
  | null;

export async function getRepartoAccess(): Promise<RepartoAccess> {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;

  // El rol repartidor manda: aunque tenga otros permisos de panel, en el
  // reparto ve solo lo suyo.
  const staff = await getStaff(session.sub);
  if (staff?.role === "repartidor") {
    if (!staff.active) return null;
    return { kind: "repartidor", id: staff.id, name: staff.name };
  }

  if (sessionHasPerm(session, "entregas")) return { kind: "admin" };
  return null;
}
