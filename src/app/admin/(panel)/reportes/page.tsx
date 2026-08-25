import { getNewCustomersStats, getTopBuyers } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { aiHabilitado } from "@/lib/ai";
import { ReportWorkspace } from "./ReportWorkspace";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  await requirePerm("reportes");
  const [stats, topBuyers] = await Promise.all([getNewCustomersStats(), getTopBuyers(10)]);

  return <ReportWorkspace enabled={aiHabilitado()} stats={stats} topBuyers={topBuyers} />;
}
