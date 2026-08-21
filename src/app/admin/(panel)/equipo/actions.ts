"use server";

import { revalidatePath } from "next/cache";
import { assertPerm } from "@/lib/auth/permissions";
import { PERM_KEYS } from "@/lib/auth/perm-modules";
import {
  createStaff,
  updateStaff,
  deleteStaff,
  NoDatabaseError,
  UsernameTakenError,
} from "@/lib/repo";
import type { StaffRole } from "@/lib/types";

export interface SaveStaffState {
  ok?: boolean;
  error?: string;
}

const ROLES: StaffRole[] = ["cajero", "cocina", "repartidor", "encargado", "admin"];

// Gestionar el equipo (y los accesos) requiere el permiso "equipo".
async function requireAdmin(): Promise<string | null> {
  return assertPerm("equipo");
}

export async function saveStaff(
  _prev: SaveStaffState,
  formData: FormData
): Promise<SaveStaffState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "cajero").trim();
  const role = (ROLES.includes(roleRaw as StaffRole) ? roleRaw : "cajero") as StaffRole;
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const active = formData.get("active") === "on";

  // Acceso al panel: usuario + contraseña + permisos por módulo.
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const permissions = formData
    .getAll("permissions")
    .map(String)
    .filter((p) => PERM_KEYS.includes(p));

  if (!name) return { error: "El nombre es obligatorio." };

  // Si se le da usuario, en el alta también hay que definir una contraseña.
  if (username && !id && !password) {
    return { error: "Definí una contraseña para que el usuario pueda ingresar." };
  }

  const data = {
    name,
    role,
    phone: phone || null,
    email: email || null,
    active,
    username: username || null,
    permissions,
    // password vacío => no se modifica (clave en updateStaff/createStaff).
    password: password || null,
  };

  try {
    if (id) {
      const updated = await updateStaff(id, data);
      if (!updated) return { error: "Integrante no encontrado." };
    } else {
      await createStaff(data);
    }
  } catch (e) {
    if (e instanceof NoDatabaseError) return { error: e.message };
    if (e instanceof UsernameTakenError) return { error: e.message };
    return { error: "No se pudo guardar el integrante." };
  }

  revalidatePath("/admin/equipo");
  return { ok: true };
}

export async function toggleStaffActive(id: string, active: boolean): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;
  try {
    await updateStaff(id, { active });
  } catch {
    return;
  }
  revalidatePath("/admin/equipo");
}

export async function removeStaff(id: string): Promise<void> {
  const denied = await requireAdmin();
  if (denied) return;
  try {
    await deleteStaff(id);
  } catch {
    return;
  }
  revalidatePath("/admin/equipo");
}
