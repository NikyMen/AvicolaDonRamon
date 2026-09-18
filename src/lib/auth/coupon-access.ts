import "server-only";

import { getStaff } from "@/lib/repo";
import { getSession } from "./session";

const COUPON_MANAGER_ROLES = new Set(["admin", "encargado"]);

export async function canManageCoupons(): Promise<boolean> {
  const session = await getSession();
  if (!session || session.role !== "admin") return false;
  if (session.sub === "admin" || session.perms?.includes("*")) return true;

  const staff = await getStaff(session.sub);
  return Boolean(staff?.active && COUPON_MANAGER_ROLES.has(staff.role));
}

export async function assertCanManageCoupons(): Promise<string | null> {
  return (await canManageCoupons())
    ? null
    : "Solo administradores o encargados pueden gestionar cupones.";
}
