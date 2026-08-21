import { listStaff } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { EquipoManager } from "./EquipoManager";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  await requirePerm("equipo");
  const team = await listStaff();
  return <EquipoManager team={team} />;
}
