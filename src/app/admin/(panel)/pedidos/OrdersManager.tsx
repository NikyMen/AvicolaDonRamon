"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, MapPin, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { deliveryEstimateLabel } from "@/lib/entrega";
import { formatARS, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/cn";
import { OrdersHeatMap } from "./OrdersHeatMap";

type Filter =
  | "todos"
  | "pagados"
  | "no_pagado"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "reasignado"
  | "cancelado";

type SortKey =
  | "id"
  | "customer"
  | "detail"
  | "delivery"
  | "payment"
  | "created"
  | "paidAt"
  | "cancelledAt"
  | "total"
  | "status";
type SortDirection = "asc" | "desc";

const paidStatuses: OrderStatus[] = ["en_preparacion", "en_camino", "entregado"];

const filters: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pagados", label: "Pagados" },
  { value: "no_pagado", label: "No pagados" },
  { value: "en_preparacion", label: "En preparación" },
  { value: "en_camino", label: "En camino" },
  { value: "entregado", label: "Entregados" },
  { value: "reasignado", label: "Reasignados" },
  { value: "cancelado", label: "Cancelados" },
];

const paymentLabels: Record<Order["payment"], string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
};

function isReassigned(order: Order): boolean {
  return order.status === "cancelado" && Boolean(order.paidAt) && Boolean(order.deliveryRetryAt);
}

function isPaid(order: Order): boolean {
  return paidStatuses.includes(order.status) || isReassigned(order);
}

function matchesFilter(order: Order, filter: Filter): boolean {
  if (filter === "todos") return true;
  if (filter === "pagados") return isPaid(order);
  if (filter === "reasignado") return isReassigned(order);
  if (filter === "cancelado") return order.status === "cancelado" && !isReassigned(order);
  return order.status === filter;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function matchesSearch(order: Order, query: string): boolean {
  if (!query) return true;
  const values = [
    order.id,
    order.customer,
    order.phone,
    order.address,
    order.deliverySlot,
    order.deliveryDate,
    paymentLabels[order.payment],
    order.status.replaceAll("_", " "),
    isReassigned(order) ? "reasignado" : undefined,
    order.total.toString(),
    ...order.items.flatMap((item) => [item.name, item.productId]),
  ];
  return normalize(values.filter(Boolean).join(" ")).includes(normalize(query));
}

function paymentState(order: Order): { label: string; className: string } {
  if (isPaid(order)) {
    return { label: "Pagado", className: "bg-emerald-100 text-emerald-700" };
  }
  if (order.status === "cancelado") {
    return { label: "Cancelado", className: "bg-red-100 text-red-700" };
  }
  return { label: "No pagado", className: "bg-orange-100 text-orange-700" };
}

function orderValue(order: Order, key: SortKey): string | number | undefined {
  switch (key) {
    case "id":
      return order.id;
    case "customer":
      return order.customer;
    case "detail":
      return order.items.map((item) => `${item.name} ${item.qty}`).join(" ");
    case "delivery":
      return `${order.deliveryDate ?? ""} ${order.deliverySlot ?? ""}`.trim() || undefined;
    case "payment":
      return `${paymentLabels[order.payment]} ${paymentState(order).label}`;
    case "created":
      return new Date(order.date).getTime();
    case "paidAt":
      return order.paidAt ? new Date(order.paidAt).getTime() : undefined;
    case "cancelledAt":
      return order.cancelledAt ? new Date(order.cancelledAt).getTime() : undefined;
    case "total":
      return order.total;
    case "status":
      return isReassigned(order) ? "reasignado" : order.status;
  }
}

function compareOrders(a: Order, b: Order, key: SortKey, direction: SortDirection): number {
  const aValue = orderValue(a, key);
  const bValue = orderValue(b, key);
  if (aValue === undefined && bValue === undefined) return 0;
  if (aValue === undefined) return 1;
  if (bValue === undefined) return -1;
  const result =
    typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue), "es", {
          numeric: true,
          sensitivity: "base",
        });
  return direction === "asc" ? result : -result;
}

export function OrdersManager({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [selectedMapOrderId, setSelectedMapOrderId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "created",
    direction: "desc",
  });

  const visibleOrders = useMemo(
    () =>
      orders
        .filter((order) => matchesFilter(order, filter) && matchesSearch(order, query.trim()))
        .slice()
        .sort((a, b) => compareOrders(a, b, sort.key, sort.direction)),
    [filter, orders, query, sort]
  );

  function changeSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function focusOrderOnMap(order: Order) {
    if (order.lat == null || order.lng == null) return;
    setSelectedMapOrderId(order.id);
    document.getElementById("orders-heat-map")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map(({ value }) => [
          value,
          orders.filter((order) => matchesFilter(order, value)).length,
        ])
      ) as Record<Filter, number>,
    [orders]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Pedidos</h1>
          <p className="text-sm text-brand-ink/55">
            {visibleOrders.length === orders.length
              ? `${orders.length} pedidos`
              : `${visibleOrders.length} de ${orders.length} pedidos`}
          </p>
        </div>
        <button className="btn-primary">Nuevo pedido</button>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <div className="relative max-w-xl">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por pedido, cliente, teléfono, producto o dirección"
            aria-label="Buscar pedidos"
            className="w-full rounded-xl border border-black/10 bg-brand-cream py-2.5 pl-10 pr-10 text-sm text-brand-ink outline-none transition focus:border-brand-red/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-brand-ink/45 hover:bg-black/5 hover:text-brand-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar pedidos por estado">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === value
                  ? "bg-brand-red text-white"
                  : "bg-brand-cream text-brand-ink/65 hover:bg-brand-red/10 hover:text-brand-red"
              )}
            >
              {label}
              <span className={filter === value ? "text-white/75" : "text-brand-ink/40"}>
                {counts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <OrdersHeatMap orders={visibleOrders} selectedOrderId={selectedMapOrderId} />

      <div className="space-y-3 md:hidden">
        {visibleOrders.map((order) => {
          const payment = paymentState(order);
          const canFocusMap = order.lat != null && order.lng != null;
          return (
            <article
              key={order.id}
              onClick={() => focusOrderOnMap(order)}
              className={cn(
                "rounded-2xl bg-white p-4 shadow-soft",
                canFocusMap ? "cursor-pointer active:bg-brand-cream/70" : ""
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-brand-ink">{order.id}</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-ink/80">
                    {order.customer}
                  </p>
                  {order.phone && (
                    <a
                      href={`tel:${order.phone}`}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 block text-xs font-bold text-brand-red"
                    >
                      {order.phone}
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isReassigned(order) ? (
                    <span className="chip bg-amber-100 text-amber-700">Reasignado</span>
                  ) : (
                    <StatusBadge status={order.status} />
                  )}
                  {canFocusMap && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-red">
                      <MapPin size={12} /> Ver mapa
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="rounded-xl bg-brand-cream/70 px-3 py-2 text-brand-ink/70">
                  {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info label="Entrega" value={deliveryEstimateLabel(order.deliverySlot, order.deliveryDate) ?? "-"} />
                  <Info label="Creado" value={formatDateTime(order.date)} />
                  <Info label="Pago" value={`${paymentLabels[order.payment]} · ${payment.label}`} />
                  <Info label="Total" value={formatARS(order.total)} strong />
                </div>
                {(order.shippingFee ?? 0) > 0 && (
                  <p className="text-xs font-semibold text-brand-ink/50">
                    Envio incluido: {formatARS(order.shippingFee ?? 0)}
                  </p>
                )}
              </div>
            </article>
          );
        })}
        {visibleOrders.length === 0 && (
          <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-brand-ink/50 shadow-soft">
            No hay pedidos que coincidan con la busqueda y el filtro.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-soft md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50">
              <tr>
                <SortHeader label="Pedido" sortKey="id" sort={sort} onSort={changeSort} />
                <SortHeader label="Cliente" sortKey="customer" sort={sort} onSort={changeSort} />
                <SortHeader label="Detalle" sortKey="detail" sort={sort} onSort={changeSort} />
                <SortHeader label="Entrega" sortKey="delivery" sort={sort} onSort={changeSort} />
                <SortHeader label="Pago" sortKey="payment" sort={sort} onSort={changeSort} />
                <SortHeader label="Creado" sortKey="created" sort={sort} onSort={changeSort} />
                <SortHeader label="Pago confirmado" sortKey="paidAt" sort={sort} onSort={changeSort} />
                <SortHeader label="Cancelado / reasignado" sortKey="cancelledAt" sort={sort} onSort={changeSort} />
                <SortHeader label="Total" sortKey="total" sort={sort} onSort={changeSort} />
                <SortHeader label="Estado" sortKey="status" sort={sort} onSort={changeSort} />
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const payment = paymentState(order);
                return (
                  <tr
                    key={order.id}
                    onClick={() => focusOrderOnMap(order)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        focusOrderOnMap(order);
                      }
                    }}
                    tabIndex={order.lat != null && order.lng != null ? 0 : undefined}
                    title={
                      order.lat != null && order.lng != null
                        ? "Ver este pedido en el mapa"
                        : undefined
                    }
                    className={cn(
                      "border-t border-black/5 hover:bg-brand-cream/50",
                      order.lat != null && order.lng != null
                        ? "cursor-pointer focus:bg-brand-cream/70 focus:outline-none"
                        : ""
                    )}
                  >
                    <td className="px-4 py-3 font-semibold text-brand-ink">{order.id}</td>
                    <td className="px-4 py-3 text-brand-ink/80">
                      <p>{order.customer}</p>
                      {order.phone && (
                        <a
                          href={`tel:${order.phone}`}
                          className="mt-0.5 block whitespace-nowrap text-xs font-semibold text-brand-red hover:underline"
                        >
                          {order.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-brand-ink/60">
                      {order.items.map((item) => `${item.qty}× ${item.name}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-brand-ink/70">
                      {deliveryEstimateLabel(order.deliverySlot, order.deliveryDate) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-brand-ink/70">
                      <p className="whitespace-nowrap">{paymentLabels[order.payment]}</p>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          payment.className
                        )}
                      >
                        {payment.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-brand-ink/60">
                      {formatDateTime(order.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-brand-ink/60">
                      {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-3 font-medium",
                        order.status === "no_pagado"
                          ? "text-orange-600"
                          : isReassigned(order)
                            ? "text-amber-700"
                            : "text-brand-red"
                      )}
                    >
                      {order.cancelledAt ? formatDateTime(order.cancelledAt) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-ink">
                      <p>{formatARS(order.total)}</p>
                      {(order.shippingFee ?? 0) > 0 && (
                        <p className="text-xs font-semibold text-brand-ink/45">
                          Envio {formatARS(order.shippingFee ?? 0)}
                        </p>
                      )}
                      {order.shippingFreeReason && (
                        <p className="text-xs font-semibold text-emerald-700">Envio gratis</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isReassigned(order) ? (
                        <span className="chip bg-amber-100 text-amber-700">Reasignado</span>
                      ) : (
                        <StatusBadge status={order.status} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-brand-ink/50">
                    No hay pedidos que coincidan con la búsqueda y el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className="px-4 py-3 font-semibold"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-brand-red"
      >
        {label}
        <Icon size={13} aria-hidden="true" className={active ? "text-brand-red" : "opacity-45"} />
      </button>
    </th>
  );
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/40">{label}</p>
      <p className={cn("mt-0.5 break-words", strong ? "font-extrabold text-brand-ink" : "font-semibold text-brand-ink/70")}>
        {value}
      </p>
    </div>
  );
}
