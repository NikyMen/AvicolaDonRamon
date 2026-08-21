import { getNewCustomersStats, getTopBuyers } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { aiHabilitado } from "@/lib/ai";
import { BusinessAIChat } from "./BusinessAIChat";
import { AdvancedReportData } from "./AdvancedReportData";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  await requirePerm("reportes");
  const [stats, topBuyers] = await Promise.all([getNewCustomersStats(), getTopBuyers(10)]);

  return (
    <div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(15rem,1fr)]">
        <BusinessAIChat enabled={aiHabilitado()} />

        <AdvancedReportData stats={stats} topBuyers={topBuyers} />
      </div>
    </div>
  );
}
