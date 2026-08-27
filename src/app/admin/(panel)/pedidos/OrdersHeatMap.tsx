"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { PARANA_CENTER } from "@/lib/geo";
import type { Order } from "@/lib/types";

const statusColor: Record<Order["status"], string> = {
  pendiente: "#9ca3af",
  no_pagado: "#f97316",
  en_preparacion: "#2563eb",
  en_camino: "#7c3aed",
  entregado: "#059669",
  cancelado: "#dc2626",
};

interface Cluster {
  lat: number;
  lng: number;
  count: number;
}

type RangePreset = "24h" | "3d" | "7d" | "month" | "manual";

const presets: { value: RangePreset; label: string }[] = [
  { value: "24h", label: "Ultimas 24hs" },
  { value: "3d", label: "Ultimos 3 dias" },
  { value: "7d", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "manual", label: "Manual" },
];

const CLUSTER_GRID_DEGREES = 0.02;

function clusterKey(lat: number, lng: number): string {
  return `${Math.round(lat / CLUSTER_GRID_DEGREES)}:${Math.round(lng / CLUSTER_GRID_DEGREES)}`;
}

function orderDeliveryTime(order: Order): number {
  const value = order.deliveredAt ?? order.dispatchedAt ?? order.date;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function multiplierFor(count: number, maxCount: number): string {
  if (maxCount <= 0) return "x1.0";
  const pressure = count / maxCount;
  return `x${(1.05 + pressure * 0.95 + Math.max(0, count - 1) * 0.12).toFixed(1)}`;
}

function heatPalette(count: number, maxCount: number) {
  const pressure = maxCount <= 0 ? 0 : count / maxCount;
  if (pressure >= 0.75) {
    return {
      label: "#ff0a0a",
      core: "rgba(200,16,46,0.72)",
      mid: "rgba(239,68,68,0.44)",
      outer: "rgba(246,180,10,0.2)",
    };
  }
  if (pressure >= 0.45) {
    return {
      label: "#f97316",
      core: "rgba(249,115,22,0.62)",
      mid: "rgba(251,146,60,0.4)",
      outer: "rgba(246,180,10,0.18)",
    };
  }
  return {
    label: "#d97706",
    core: "rgba(246,180,10,0.56)",
    mid: "rgba(251,191,36,0.34)",
    outer: "rgba(254,243,199,0.2)",
  };
}

export function OrdersHeatMap({
  orders,
  selectedOrderId,
}: {
  orders: Order[];
  selectedOrderId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [manualStart, setManualStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toInputDate(d);
  });
  const [manualEnd, setManualEnd] = useState(() => toInputDate(new Date()));

  const range = useMemo(() => {
    const now = new Date();
    if (preset === "manual") {
      return {
        start: startOfDay(new Date(`${manualStart}T00:00:00`)).getTime(),
        end: endOfDay(new Date(`${manualEnd}T00:00:00`)).getTime(),
      };
    }
    const start = new Date(now);
    if (preset === "24h") start.setHours(start.getHours() - 24);
    if (preset === "3d") start.setDate(start.getDate() - 3);
    if (preset === "7d") start.setDate(start.getDate() - 7);
    if (preset === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    return { start: start.getTime(), end: now.getTime() };
  }, [manualEnd, manualStart, preset]);

  const points = useMemo(
    () =>
      orders
        .filter((o) => {
          const time = orderDeliveryTime(o);
          return o.lat != null && o.lng != null && time >= range.start && time <= range.end;
        })
        .map((o) => ({ ...o, lat: o.lat as number, lng: o.lng as number })),
    [orders, range]
  );

  const clusters = useMemo(() => {
    const grouped = new Map<string, Cluster>();
    for (const point of points) {
      const key = clusterKey(point.lat, point.lng);
      const current = grouped.get(key) ?? { lat: point.lat, lng: point.lng, count: 0 };
      current.count += 1;
      current.lat = (current.lat * (current.count - 1) + point.lat) / current.count;
      current.lng = (current.lng * (current.count - 1) + point.lng) / current.count;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [points]);

  const hot = clusters[0];
  const maxClusterCount = hot?.count ?? 0;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      L.DomEvent.disableScrollPropagation(containerRef.current);
      L.DomEvent.disableClickPropagation(containerRef.current);
      const map = L.map(containerRef.current, {
        center: [PARANA_CENTER.lat, PARANA_CENTER.lng],
        zoom: 12,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const stopWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const stopMiddleMouse = (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener("wheel", stopWheel, { passive: false });
    el.addEventListener("mousedown", stopMiddleMouse);
    el.addEventListener("auxclick", stopMiddleMouse);
    return () => {
      el.removeEventListener("wheel", stopWheel);
      el.removeEventListener("mousedown", stopMiddleMouse);
      el.removeEventListener("auxclick", stopMiddleMouse);
    };
  }, []);

  useEffect(() => {
    import("leaflet").then((L) => {
      const layer = layerRef.current;
      if (!layer) return;
      layer.clearLayers();

      for (const cluster of clusters) {
        const size = Math.min(150, 82 + cluster.count * 24);
        const palette = heatPalette(cluster.count, maxClusterCount);
        const multiplier = multiplierFor(cluster.count, maxClusterCount);
        const icon = L.divIcon({
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `
            <div style="position:relative;width:${size}px;height:${size}px;pointer-events:none;">
              <div style="
                position:absolute;
                inset:0;
                border-radius:999px;
                background:
                  radial-gradient(circle at 50% 52%,
                    ${palette.core} 0%,
                    ${palette.core} 16%,
                    ${palette.mid} 38%,
                    ${palette.outer} 62%,
                    rgba(255,255,255,0) 76%);
                filter:blur(7px);
                transform:scaleX(1.22) rotate(-8deg);
              "></div>
              <div style="
                position:absolute;
                left:50%;
                top:50%;
                transform:translate(-50%,-50%);
                border-radius:999px;
                background:${palette.label};
                color:white;
                padding:5px 10px;
                font-size:12px;
                font-weight:800;
                line-height:1;
                white-space:nowrap;
                box-shadow:0 8px 18px rgba(0,0,0,0.22);
              ">${multiplier}</div>
            </div>
          `,
        });
        L.marker([cluster.lat, cluster.lng], {
          icon,
          interactive: false,
          keyboard: false,
          zIndexOffset: 300,
        }).addTo(layer);
      }

      for (const point of points) {
        const color = statusColor[point.status];
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: 3.5,
          color: "#ffffff",
          fillColor: color,
          fillOpacity: 0.8,
          opacity: 0.9,
          weight: 1,
        })
          .bindPopup(`<b>${point.id}</b><br/>${point.customer}<br/>${point.address ?? ""}`);
        marker.addTo(layer);
        if (selectedOrderId === point.id) {
          mapRef.current?.setView([point.lat, point.lng], 15, { animate: true });
          marker.openPopup();
        }
      }

      if (points.length > 0 && !selectedOrderId) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        mapRef.current?.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
      }
    });
  }, [clusters, maxClusterCount, points, selectedOrderId]);

  return (
    <section
      id="orders-heat-map"
      className="relative z-0 isolate rounded-2xl bg-white p-4 shadow-soft"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-brand-ink">Mapa de pedidos</h2>
          <p className="text-sm text-brand-ink/55">
            Pedidos repartidos dentro del intervalo elegido.
          </p>
        </div>
        <div className="text-right text-xs font-semibold text-brand-ink/55">
          <p>{points.length} puntos con ubicacion</p>
          {hot && (
            <p className="text-brand-red">
              Mayor demanda: {hot.count} pedido(s) · {multiplierFor(hot.count, maxClusterCount)}
            </p>
          )}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreset(option.value)}
              aria-pressed={preset === option.value}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                preset === option.value
                  ? "bg-brand-red text-white"
                  : "bg-brand-cream text-brand-ink/65 hover:bg-brand-red/10 hover:text-brand-red"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {preset === "manual" && (
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink/60">
              Desde
              <input
                type="date"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-brand-ink"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink/60">
              Hasta
              <input
                type="date"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-brand-ink"
              />
            </label>
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative z-0 isolate h-[360px] overflow-hidden overscroll-contain rounded-xl border border-black/10"
      />
    </section>
  );
}
