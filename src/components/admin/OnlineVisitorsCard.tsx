"use client";

import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";

export function OnlineVisitorsCard({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/analytics/online", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && Number.isInteger(data?.count)) setCount(data.count);
      } catch {
        // Conservamos el último valor si falla una actualización.
      }
    };
    const timer = window.setInterval(() => void refresh(), 10_000);
    void refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
        <Wifi size={20} />
      </span>
      <p className="mt-3 text-2xl font-bold text-brand-ink">{count.toLocaleString("es-AR")}</p>
      <p className="text-sm text-brand-ink/55">Personas en línea ahora</p>
    </div>
  );
}
