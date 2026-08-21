"use client";

import { useEffect, useState } from "react";
import { CalendarDays, TrendingUp, UserPlus, Users } from "lucide-react";
import { formatARS, formatCantidad } from "@/lib/format";

const KEY = "admin:advanced-report-data";

type Props = {
  stats: { total: number; thisMonth: number; last30Days: number; lastMonth: number; byMonth: { month: string; label: string; count: number }[] };
  topBuyers: { id: string; name: string; spent: number; orders: number }[];
};

export function AdvancedReportData({ stats, topBuyers }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(localStorage.getItem(KEY) !== "false");
  }, []);

  if (!visible) return null;

  const maxMonth = Math.max(1, ...stats.byMonth.map((m) => m.count));
  const delta = stats.thisMonth - stats.lastMonth;
  const cards = [
    { label: "Clientes totales", value: formatCantidad(stats.total), icon: Users },
    { label: "Nuevos este mes", value: formatCantidad(stats.thisMonth), icon: UserPlus },
    { label: "Últimos 30 días", value: formatCantidad(stats.last30Days), icon: CalendarDays },
    { label: "vs. mes anterior", value: `${delta >= 0 ? "+" : ""}${formatCantidad(delta)}`, icon: TrendingUp },
  ];

  return (
    <section className="space-y-3" aria-label="Datos avanzados de reportes">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {cards.map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-soft">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red"><card.icon size={16} /></span>
            <div className="min-w-0"><p className="text-lg font-bold leading-tight text-brand-ink">{card.value}</p><p className="truncate text-[11px] text-brand-ink/55">{card.label}</p></div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white p-3 shadow-soft">
        <h2 className="mb-2 text-xs font-semibold text-brand-ink">Clientes nuevos por mes</h2>
        <div className="flex h-28 items-end justify-between gap-2">
          {stats.byMonth.map((month) => <div key={month.month} className="flex h-full flex-1 flex-col items-center gap-1"><span className="text-[10px] font-semibold text-brand-ink/65">{month.count}</span><div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-brand-gold" style={{ height: `${(month.count / maxMonth) * 100}%`, minHeight: month.count > 0 ? 3 : 0 }} /></div><span className="text-[10px] capitalize text-brand-ink/50">{month.label}</span></div>)}
        </div>
      </div>
      <div className="rounded-xl bg-white p-3 shadow-soft">
        <h2 className="mb-2 text-xs font-semibold text-brand-ink">Top de compradores</h2>
        <ol className="grid gap-x-4 gap-y-1">
          {topBuyers.map((customer, index) => <li key={customer.id} className="flex min-w-0 items-center gap-2 border-t border-black/5 py-1 first:border-0"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-cream text-[9px] font-bold text-brand-ink/65">{index + 1}</span><p className="min-w-0 flex-1 truncate text-[11px] font-medium text-brand-ink">{customer.name}</p><p className="whitespace-nowrap text-[10px] font-semibold text-brand-ink/65">{formatARS(customer.spent)} · {customer.orders}</p></li>)}
          {topBuyers.length === 0 && <li className="py-5 text-center text-xs text-brand-ink/50">Todavía no hay datos.</li>}
        </ol>
      </div>
    </section>
  );
}
