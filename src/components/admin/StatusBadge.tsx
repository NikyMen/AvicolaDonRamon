import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const map: Record<OrderStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  no_pagado: { label: "No pagado", className: "bg-orange-100 text-orange-700" },
  en_preparacion: { label: "En preparación", className: "bg-blue-100 text-blue-700" },
  en_camino: { label: "En camino", className: "bg-violet-100 text-violet-700" },
  entregado: { label: "Entregado", className: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = map[status];
  return <span className={cn("chip", s.className)}>{s.label}</span>;
}
