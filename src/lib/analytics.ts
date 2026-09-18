import { Prisma } from "@prisma/client";
import { prisma, hasDatabase } from "./prisma";
import { products as mockProducts } from "./data";

export type AnalyticsEventType = "visit" | "cart_add";

// Zona horaria del negocio: los buckets de día/hora se calculan en hora argentina,
// independientemente de la zona del servidor.
const TZ = "America/Argentina/Buenos_Aires";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", hour12: false, timeZone: TZ,
});
const labelFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ,
});

interface RawEvent {
  type: AnalyticsEventType;
  productId: string | null;
  createdAt: Date;
}

// Fallback en memoria para cuando no hay DATABASE_URL (solo dev).
// Se cuelga de globalThis para sobrevivir al hot-reload de Next.
const memEvents: RawEvent[] = ((globalThis as Record<string, unknown>).__memAnalytics ??=
  []) as RawEvent[];
const memPresence: Map<string, Date> = ((globalThis as Record<string, unknown>).__memPresence ??=
  new Map<string, Date>()) as Map<string, Date>;
const ONLINE_WINDOW_MS = 45_000;

export async function recordEvent(input: {
  type: AnalyticsEventType;
  productId?: string | null;
  path?: string | null;
}): Promise<void> {
  if (hasDatabase) {
    await prisma.analyticsEvent.create({
      data: { type: input.type, productId: input.productId ?? null, path: input.path ?? null },
    });
    return;
  }
  memEvents.push({ type: input.type, productId: input.productId ?? null, createdAt: new Date() });
}

export async function recordPresence(sessionId: string, path?: string | null): Promise<void> {
  const now = new Date();
  if (hasDatabase) {
    await prisma.analyticsSession.upsert({
      where: { id: sessionId },
      update: { path: path ?? null, lastSeenAt: now },
      create: { id: sessionId, path: path ?? null, lastSeenAt: now },
    });
    return;
  }
  memPresence.set(sessionId, now);
}

export async function countOnlineVisitors(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  if (hasDatabase) {
    return prisma.analyticsSession.count({ where: { lastSeenAt: { gte: since } } });
  }
  for (const [id, lastSeenAt] of memPresence) {
    if (lastSeenAt < since) memPresence.delete(id);
  }
  return memPresence.size;
}

function dayKey(d: Date): string {
  // en-CA => YYYY-MM-DD
  return dayFormatter.format(d);
}

function hourOf(d: Date): number {
  return Number(hourFormatter.format(d)) % 24;
}

/** Rango de fechas para acotar las métricas. */
export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsSummary {
  /** Total de visitas en el rango seleccionado. */
  visitsInRange: number;
  /** Total de agregados al carrito en el rango seleccionado. */
  cartAddsInRange: number;
  /** Cantidad de días que abarca el rango (>= 1). */
  rangeDays: number;
  /** Promedio de visitas por día en el rango. */
  visitsPerDay: number;
  /** Visitas por día dentro del rango, en orden cronológico. */
  visitsByDay: { day: string; label: string; visitas: number }[];
  /** Visitas por hora (0-23) acumuladas en el rango. */
  visitsByHour: { hour: string; visitas: number }[];
  /** Hora pico dentro del rango, null si no hay datos. */
  peakHour: number | null;
  /** Productos más agregados al carrito en el rango. */
  topCart: { name: string; agregados: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface AnalyticsCountRow {
  type: AnalyticsEventType;
  count: number;
}

interface DayCountRow {
  day: string;
  count: number;
}

interface HourCountRow {
  hour: number;
  count: number;
}

interface TopCartRow {
  name: string;
  agregados: number;
}

async function getDatabaseAggregates(from: Date, to: Date) {
  const rangeFilter = Prisma.sql`"createdAt" >= ${from} AND "createdAt" <= ${to}`;

  const [counts, days, hours, topCart] = await Promise.all([
    prisma.$queryRaw<AnalyticsCountRow[]>`
      SELECT "type"::text AS "type", COUNT(*)::int AS "count"
      FROM "AnalyticsEvent"
      WHERE ${rangeFilter} AND "type" IN ('visit', 'cart_add')
      GROUP BY "type"
    `,
    prisma.$queryRaw<DayCountRow[]>`
      SELECT TO_CHAR(
        DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}),
        'YYYY-MM-DD'
      ) AS "day", COUNT(*)::int AS "count"
      FROM "AnalyticsEvent"
      WHERE ${rangeFilter} AND "type" = 'visit'
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<HourCountRow[]>`
      SELECT EXTRACT(
        HOUR FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})
      )::int AS "hour", COUNT(*)::int AS "count"
      FROM "AnalyticsEvent"
      WHERE ${rangeFilter} AND "type" = 'visit'
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<TopCartRow[]>`
      SELECT COALESCE(p."name", e."productId") AS "name", COUNT(*)::int AS "agregados"
      FROM "AnalyticsEvent" e
      LEFT JOIN "Product" p ON p."id" = e."productId"
      WHERE e."createdAt" >= ${from}
        AND e."createdAt" <= ${to}
        AND e."type" = 'cart_add'
        AND e."productId" IS NOT NULL
      GROUP BY e."productId", p."name"
      ORDER BY "agregados" DESC
      LIMIT 7
    `,
  ]);

  const totals = new Map(counts.map((row) => [row.type, Number(row.count)]));
  return {
    visits: totals.get("visit") ?? 0,
    cartAdds: totals.get("cart_add") ?? 0,
    days,
    hours,
    topCart: topCart.map((row) => ({ name: row.name, agregados: Number(row.agregados) })),
  };
}

export async function getAnalyticsSummary(range?: DateRange): Promise<AnalyticsSummary> {
  const now = new Date();
  const to = range?.to ?? now;
  const from = range?.from ?? new Date(to.getTime() - 7 * DAY_MS);

  // En producción la base devuelve solo agregados pequeños. Evitamos cargar
  // cada evento en memoria, que hacía que la navegación se frenara al crecer
  // el historial de visitas.
  const databaseAggregates = hasDatabase ? await getDatabaseAggregates(from, to) : null;
  const events: RawEvent[] = hasDatabase
    ? []
    : memEvents.filter((e) => e.createdAt >= from && e.createdAt <= to);

  // Buckets de día (en hora argentina) recorriendo el rango día por día.
  // Se acota a 366 buckets para evitar rangos disparatados.
  const dayBuckets = new Map<string, number>();
  const dayLabels = new Map<string, string>();
  const toKey = dayKey(to);
  for (let t = from.getTime(), guard = 0; guard < 366; t += DAY_MS, guard++) {
    const d = new Date(t);
    const key = dayKey(d);
    if (!dayBuckets.has(key)) {
      dayBuckets.set(key, 0);
      dayLabels.set(key, labelFormatter.format(d));
    }
    if (key >= toKey) break;
  }
  // Garantizar que el último día del rango esté presente.
  if (!dayBuckets.has(toKey)) {
    dayBuckets.set(toKey, 0);
    dayLabels.set(toKey, labelFormatter.format(to));
  }

  const hourBuckets = new Array<number>(24).fill(0);
  const cartCounts = new Map<string, number>();
  let visitsInRange = databaseAggregates?.visits ?? 0;
  let cartAddsInRange = databaseAggregates?.cartAdds ?? 0;

  for (const row of databaseAggregates?.days ?? []) {
    if (dayBuckets.has(row.day)) dayBuckets.set(row.day, Number(row.count));
  }
  for (const row of databaseAggregates?.hours ?? []) {
    if (row.hour >= 0 && row.hour < 24) hourBuckets[row.hour] = Number(row.count);
  }

  for (const e of events) {
    const key = dayKey(e.createdAt);
    if (e.type === "visit") {
      visitsInRange++;
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
      hourBuckets[hourOf(e.createdAt)]++;
    } else if (e.type === "cart_add") {
      cartAddsInRange++;
      if (e.productId) cartCounts.set(e.productId, (cartCounts.get(e.productId) ?? 0) + 1);
    }
  }

  // En desarrollo sin base resolvemos los nombres contra los datos de muestra.
  const topIds = [...cartCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  let names = new Map<string, string>();
  if (topIds.length > 0) {
    names = new Map(mockProducts.map((p) => [p.id, p.name]));
  }

  const maxHour = Math.max(...hourBuckets);
  const rangeDays = dayBuckets.size;

  return {
    visitsInRange,
    cartAddsInRange,
    rangeDays,
    visitsPerDay: rangeDays > 0 ? Math.round(visitsInRange / rangeDays) : 0,
    visitsByDay: [...dayBuckets.entries()].map(([day, visitas]) => ({
      day,
      label: dayLabels.get(day) ?? day,
      visitas,
    })),
    visitsByHour: hourBuckets.map((visitas, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      visitas,
    })),
    peakHour: maxHour > 0 ? hourBuckets.indexOf(maxHour) : null,
    topCart:
      databaseAggregates?.topCart ??
      topIds.map(([id, agregados]) => ({ name: names.get(id) ?? id, agregados })),
  };
}
