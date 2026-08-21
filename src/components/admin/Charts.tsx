"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

const COLORS = ["#C8102E", "#F6B40A", "#1F1A17", "#9CA3AF"];

export function SalesChart({ data }: { data: { day: string; ventas: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8102E" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="#1F1A1780" />
        <YAxis
          tickFormatter={(v) => `$${v / 1000}k`}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#1F1A1780"
          width={48}
        />
        <Tooltip
          formatter={(v: number) => [`$${v.toLocaleString("es-AR")}`, "Ventas"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #00000010" }}
        />
        <Area
          type="monotone"
          dataKey="ventas"
          stroke="#C8102E"
          strokeWidth={2.5}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PaymentPie({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-brand-ink/50">No hay ventas en el período.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
