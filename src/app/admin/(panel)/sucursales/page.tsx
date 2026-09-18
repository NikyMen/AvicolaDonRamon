import { requirePerm } from "@/lib/auth/permissions";
import { listSucursales } from "@/lib/repo";
import { SucursalesManager } from "./SucursalesManager";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  await requirePerm("sucursales");
  const branches = await listSucursales({ includeInactive: true });
  return <SucursalesManager branches={branches} />;
}
