import { Eye, ShoppingCart, Clock, TrendingUp } from "lucide-react";
import {
  countOnlineVisitors,
  getAnalyticsSummary,
  type DateRange,
} from "@/lib/analytics";
import { requirePerm } from "@/lib/auth/permissions";
import {
  VisitsAreaChart,
  HourlyBarChart,
  TopCartChart,
} from "@/components/admin/AnalyticsCharts";
import { AnalyticsRangeControls } from "@/components/admin/AnalyticsRangeControls";
import { OnlineVisitorsCard } from "@/components/admin/OnlineVisitorsCard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_DAYS: Record<string, number> = { "7d": 7, "1m": 30, "3m": 90 };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Resuelve el rango a partir de los parámetros de la URL. */
function resolveRange(params: { preset?: string; from?: string; to?: string }): {
  range: DateRange;
  preset: string | null;
  fromInput: string;
  toInput: string;
} {
  const now = new Date();

  // Rango personalizado por fechas explícitas.
  if (params.from && params.to) {
    const fromDate = new Date(`${params.from}T00:00:00`);
    const toDate = new Date(`${params.to}T23:59:59.999`);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate <= toDate) {
      return {
        range: { from: fromDate, to: toDate },
        preset: null,
        fromInput: params.from,
        toInput: params.to,
      };
    }
  }

  // Preset (por defecto: últimos 7 días).
  const preset = params.preset && PRESET_DAYS[params.preset] ? params.preset : "7d";
  const days = PRESET_DAYS[preset];
  const from = new Date(now.getTime() - (days - 1) * DAY_MS);
  from.setHours(0, 0, 0, 0);
  return {
    range: { from, to: now },
    preset,
    fromInput: isoDay(from),
    toInput: isoDay(now),
  };
}

const PRESET_LABELS: Record<string, string> = {
  "7d": "últimos 7 días",
  "1m": "último mes",
  "3m": "últimos 3 meses",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requirePerm("analitica");
  const params = await searchParams;
  const { range, preset, fromInput, toInput } = resolveRange(params);
  const [s, onlineVisitors] = await Promise.all([
    getAnalyticsSummary(range),
    countOnlineVisitors(),
  ]);

  const periodLabel =
    preset && PRESET_LABELS[preset]
      ? PRESET_LABELS[preset]
      : `${range.from.toLocaleDateString("es-AR")} – ${range.to.toLocaleDateString("es-AR")}`;

  const stats = [
    { label: "Visitas en el período", value: s.visitsInRange.toLocaleString("es-AR"), icon: Eye },
    { label: "Promedio diario", value: s.visitsPerDay.toLocaleString("es-AR"), icon: TrendingUp },
    {
      label: "Hora pico",
      value: s.peakHour === null ? "—" : `${String(s.peakHour).padStart(2, "0")}:00`,
      icon: Clock,
    },
    {
      label: "Agregados al carrito",
      value: s.cartAddsInRange.toLocaleString("es-AR"),
      icon: ShoppingCart,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Analítica</h1>
        <p className="text-sm text-brand-ink/55">
          Visitas a la tienda y actividad del carrito · {periodLabel}
        </p>
      </div>

      <AnalyticsRangeControls preset={preset} from={fromInput} to={toInput} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <OnlineVisitorsCard initialCount={onlineVisitors} />
        {stats.map((st) => (
          <div key={st.label} className="rounded-2xl bg-white p-4 shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
              <st.icon size={20} />
            </span>
            <p className="mt-3 text-2xl font-bold text-brand-ink">{st.value}</p>
            <p className="text-sm text-brand-ink/55">{st.label}</p>
          </div>
        ))}
      </div>

      {/* Visitas por día + por hora */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="mb-2 font-semibold text-brand-ink">Visitas por día</h2>
          <VisitsAreaChart data={s.visitsByDay} />
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-brand-ink">Visitas por hora</h2>
            {s.peakHour !== null && (
              <span className="rounded-full bg-brand-red/10 px-2.5 py-1 text-xs font-semibold text-brand-red">
                Pico: {String(s.peakHour).padStart(2, "0")}:00
              </span>
            )}
          </div>
          <HourlyBarChart data={s.visitsByHour} peakHour={s.peakHour} />
        </div>
      </div>

      {/* Top carrito */}
      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="mb-2 font-semibold text-brand-ink">
          Productos más agregados al carrito
        </h2>
        {s.topCart.length > 0 ? (
          <TopCartChart data={s.topCart} />
        ) : (
          <p className="py-10 text-center text-sm text-brand-ink/50">
            Todavía no hay actividad de carrito registrada. Los datos aparecen a medida que los
            clientes usan la tienda.
          </p>
        )}
      </div>
    </div>
  );
}
