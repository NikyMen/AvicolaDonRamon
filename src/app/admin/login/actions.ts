"use server";

import { redirect } from "next/navigation";
import { verifyAdminCredentials } from "@/lib/auth/admin";
import { setSessionCookie } from "@/lib/auth/session";
import { ALL_PERMS } from "@/lib/auth/perm-modules";
import { verifyStaffLogin } from "@/lib/repo";

export interface AdminLoginState {
  error?: string;
}

export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!user || !password) {
    return { error: "Ingresá usuario y contraseña." };
  }

  // 1) Super-admin por variables de entorno: acceso total.
  let sessionData: Parameters<typeof setSessionCookie>[0] | null = null;
  let esRepartidor = false;

  if (verifyAdminCredentials(user, password)) {
    sessionData = { sub: "admin", name: "Administrador", phone: "", role: "admin", perms: [ALL_PERMS] };
  } else {
    // 2) Empleado con login propio: permisos según lo asignado en Equipo.
    const staff = await verifyStaffLogin(user, password);
    if (staff) {
      sessionData = {
        sub: staff.id,
        name: staff.name,
        phone: staff.phone ?? "",
        role: "admin",
        perms: staff.permissions,
      };
      esRepartidor = staff.role === "repartidor";
    }
  }

  if (!sessionData) {
    // Pequeña demora para frenar fuerza bruta.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Usuario o contraseña incorrectos." };
  }

  await setSessionCookie(sessionData);

  // Los repartidores van directo a su ruta; el resto, solo a destinos internos.
  if (esRepartidor) redirect("/reparto");
  redirect(next.startsWith("/admin") || next === "/reparto" ? next : "/admin");
}
