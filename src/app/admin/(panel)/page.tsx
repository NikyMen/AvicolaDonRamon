import { MessageCircle, Activity, Sparkles } from "lucide-react";
import { getWhatsappFlowDashboard } from "@/lib/whatsapp-assistant";
import { FlowDashboardCharts } from "@/components/admin/FlowDashboardCharts";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { getDashboardSummary, type DashboardPeriod } from "@/lib/dashboard";
import { listOrders } from "@/lib/repo";
import { formatARS, formatCantidad } from "@/lib/format";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SalesChart, PaymentPie } from "@/components/admin/Charts";

export const dynamic = "force-dynamic";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "yesterday", label: "Ayer" },
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "14d", label: "Últimos 14 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "60d", label: "Últimos 60 días" },
];

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  yesterday: "ayer",
  today: "hoy",
  "7d": "últimos 7 días",
  "14d": "últimos 14 días",
  "30d": "últimos 30 días",
  "60d": "últimos 60 días",
};

function resolvePeriod(value?: string): DashboardPeriod {
  return PERIODS.some((period) => period.value === value) ? (value as DashboardPeriod) : "30d";
}

function changeLabel(change: number | null, period: DashboardPeriod): string {
  if (change === null) return "Nuevo";
  const comparison = period === "today" ? "ayer" : period === "yesterday" ? "anteayer" : "período anterior";
  return `${change > 0 ? "+" : ""}${change}% vs. ${comparison}`;
}

function changeTone(change: number | null): "up" | "down" | "flat" {
  if (change === null || change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

async function SalesDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = resolvePeriod((await searchParams).period);
  const periodLabel = PERIOD_LABELS[period];
  const [summary, orders] = await Promise.all([
    getDashboardSummary(period),
    listOrders({ statusIn: ["en_preparacion", "en_camino", "entregado"], limit: 6 }),
  ]);
  const stats = [
    {
      label: period === "today" || period === "yesterday" ? `Ventas de ${periodLabel}` : `Ventas · ${periodLabel}`,
      value: formatARS(summary.salesToday.value),
      delta: changeLabel(summary.salesToday.change, period),
      trend: changeTone(summary.salesToday.change),
      icon: DollarSign,
    },
    {
      label: period === "today" || period === "yesterday" ? `Pedidos pagados ${periodLabel}` : `Pedidos pagados · ${periodLabel}`,
      value: formatCantidad(summary.ordersToday.value),
      delta: changeLabel(summary.ordersToday.change, period),
      trend: changeTone(summary.ordersToday.change),
      icon: ShoppingCart,
    },
    {
      label: "Clientes registrados",
      value: formatCantidad(summary.customers.total),
      delta: `${formatCantidad(summary.customers.newToday)} nuevos hoy`,
      trend: summary.customers.newToday > 0 ? "up" : "flat",
      icon: Users,
    },
    {
      label: period === "today" || period === "yesterday" ? `Productos vendidos ${periodLabel}` : `Productos vendidos · ${periodLabel}`,
      value: formatCantidad(summary.productsSoldToday.value),
      delta: changeLabel(summary.productsSoldToday.change, period),
      trend: changeTone(summary.productsSoldToday.change),
      icon: Package,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Dashboard</h1>
        <p className="text-sm text-brand-ink/55">
          Resumen de actividad · {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "America/Argentina/Buenos_Aires",
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-soft" aria-label="Filtrar ventas por período">
        {PERIODS.map((option) => (
          <Link
            key={option.value}
            href={`/admin?view=comercial&period=${option.value}`}
            aria-current={period === option.value ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              period === option.value
                ? "bg-brand-red text-white"
                : "bg-brand-cream text-brand-ink/70 hover:bg-black/5"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                <s.icon size={20} />
              </span>
              <span
                className={`flex items-center gap-0.5 text-xs font-semibold ${
                  s.trend === "up"
                    ? "text-emerald-600"
                    : s.trend === "down"
                      ? "text-brand-red"
                      : "text-brand-ink/45"
                }`}
              >
                {s.trend === "up" ? (
                  <ArrowUpRight size={14} />
                ) : s.trend === "down" ? (
                  <ArrowDownRight size={14} />
                ) : (
                  <Minus size={14} />
                )}
                {s.delta}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-brand-ink">{s.value}</p>
            <p className="text-sm text-brand-ink/55">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-soft lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-brand-ink">Ventas · {periodLabel}</h2>
          </div>
          <SalesChart data={summary.salesByDay} />
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="mb-2 font-semibold text-brand-ink">Métodos de pago · {periodLabel}</h2>
          <PaymentPie data={summary.paymentMethods} />
        </div>
      </div>

      {/* Recent orders + top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-soft lg:col-span-2">
          <h2 className="mb-3 font-semibold text-brand-ink">Pedidos recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-brand-ink/50">
                  <th className="pb-2 pr-3 font-semibold">Pedido</th>
                  <th className="pb-2 pr-3 font-semibold">Cliente</th>
                  <th className="pb-2 pr-3 font-semibold">Total</th>
                  <th className="pb-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-black/5">
                    <td className="py-2.5 pr-3 font-semibold text-brand-ink">{o.id}</td>
                    <td className="py-2.5 pr-3 text-brand-ink/70">{o.customer}</td>
                    <td className="py-2.5 pr-3 font-medium text-brand-ink">{formatARS(o.total)}</td>
                    <td className="py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="mb-3 font-semibold text-brand-ink">Más vendidos · {periodLabel}</h2>
          {summary.topProducts.length > 0 ? (
            <ul className="space-y-3">
              {summary.topProducts.map((p) => (
                <li key={p.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-brand-ink">{p.name}</span>
                    <span className="text-brand-ink/55">{formatCantidad(p.sold)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full bg-brand-gold" style={{ width: `${p.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-brand-ink/50">
              Todavía no hay ventas en este período.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

async function WhatsappDashboard() { const data = await getWhatsappFlowDashboard(); const cards = [{ label: "Interacciones del flujo hoy", value: data.today.interactions, icon: MessageCircle }, { label: "Contactos interactuados hoy", value: data.today.contacts, icon: Users }, { label: "Chats activos · 7 días", value: data.activeContacts, icon: Activity }, { label: "Contactos registrados", value: data.totalContacts, icon: Users }]; return <div className="space-y-6"><div><div className="flex items-center gap-2"><Sparkles className="text-brand-red" size={24} /><h1 className="text-2xl font-bold text-brand-ink">Dashboard IA</h1></div><p className="text-sm text-brand-ink/55">Actividad exclusiva del flujo de WhatsApp y sus chats. No incluye conversaciones de otros canales.</p></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map((card) => <div key={card.label} className="rounded-2xl bg-white p-4 shadow-soft"><card.icon className="text-brand-red" size={20} /><p className="mt-3 text-2xl font-bold text-brand-ink">{formatCantidad(card.value)}</p><p className="text-sm text-brand-ink/55">{card.label}</p></div>)}</div><div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-1 font-semibold text-brand-ink">Interacciones del flujo</h2><p className="mb-3 text-xs text-brand-ink/50">Últimos 7 días · asociado a teléfono y leadId</p><FlowDashboardCharts data={data.byDay} /></div><div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm text-brand-ink"><strong>Contexto protegido del agente:</strong> el flujo recibe el teléfono y leadId del chat actual y debe usar solo esa conversación.</div></div>; }


export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ view?: string; period?: string }> }) {
  const params = await searchParams;
  const commercial = params.view === "comercial";
  return <div className="space-y-6">
    <nav className="flex gap-2" aria-label="Tipo de dashboard">
      <Link href="/admin" className={commercial ? "btn-secondary" : "btn-primary"} aria-current={!commercial ? "page" : undefined}>WhatsApp</Link>
      <Link href="/admin?view=comercial" className={commercial ? "btn-primary" : "btn-secondary"} aria-current={commercial ? "page" : undefined}>Comercial</Link>
    </nav>
    {commercial ? <SalesDashboard searchParams={Promise.resolve(params)} /> : <WhatsappDashboard />}
  </div>;
}
