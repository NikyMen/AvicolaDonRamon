"use client";

import { useEffect, useState } from "react";
import {
  ADMIN_PREFERENCES_EVENT,
  ADVANCED_REPORTS_KEY,
  DEFAULT_ADVANCED_REPORTS_VISIBLE,
} from "@/lib/admin-preferences";
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
};

export function ReportWorkspace({ enabled, stats, topBuyers }: Props) {
  const [advancedVisible, setAdvancedVisible] = useState(DEFAULT_ADVANCED_REPORTS_VISIBLE);

  useEffect(() => {
    const sync = () => {
      const value = localStorage.getItem(ADVANCED_REPORTS_KEY);
      setAdvancedVisible(
        value === null ? DEFAULT_ADVANCED_REPORTS_VISIBLE : value === "true"
      );
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(ADMIN_PREFERENCES_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ADMIN_PREFERENCES_EVENT, sync);
    };
  }, []);

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
