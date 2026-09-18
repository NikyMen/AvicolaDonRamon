import { getNewCustomersStats, getTopBuyers, getAdminUiSettings } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { aiHabilitado } from "@/lib/ai";
import { ReportWorkspace } from "./ReportWorkspace";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  await requirePerm("reportes");
  const [stats, topBuyers, uiSettings] = await Promise.all([
    getNewCustomersStats(),
    getTopBuyers(10),
    getAdminUiSettings(),
  ]);

  return (
    <ReportWorkspace
      enabled={aiHabilitado()}
      stats={stats}
      topBuyers={topBuyers}
      advancedVisible={uiSettings.advancedReports}
    />
  );
}
