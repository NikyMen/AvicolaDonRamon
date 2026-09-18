import { BusinessAIChat } from "./BusinessAIChat";
import { AdvancedReportData } from "./AdvancedReportData";

type Props = {
  enabled: boolean;
  stats: {
    total: number;
    thisMonth: number;
    last30Days: number;
    lastMonth: number;
    byMonth: { month: string; label: string; count: number }[];
  };
  topBuyers: { id: string; name: string; spent: number; orders: number }[];
  advancedVisible: boolean;
};

export function ReportWorkspace({ enabled, stats, topBuyers, advancedVisible }: Props) {
  return (
    <div
      className={
        advancedVisible
          ? "grid items-stretch gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(15rem,1fr)]"
          : "grid items-stretch"
      }
    >
      <BusinessAIChat enabled={enabled} />
      {advancedVisible && <AdvancedReportData stats={stats} topBuyers={topBuyers} />}
    </div>
  );
}
