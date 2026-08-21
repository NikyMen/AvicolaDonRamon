"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const RED = "#C8102E";
const GOLD = "#F6B40A";
const INK = "#1F1A17";

const tooltipStyle = { borderRadius: 12, border: "1px solid #00000010", fontSize: 13 };

export function VisitsAreaChart({
  data,
}: {
  data: { label: string; visitas: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="visitsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
            <stop offset="100%" stopColor={RED} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#1F1A1780"
          interval={data.length > 14 ? Math.ceil(data.length / 10) : 0}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#1F1A1780" width={36} allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, "Visitas"]} contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="visitas"
          stroke={RED}
          strokeWidth={2.5}
          fill="url(#visitsGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourlyBarChart({
  data,
  peakHour,
}: {
  data: { hour: string; visitas: number }[];
  peakHour: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={10} stroke="#1F1A1780" interval={2} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#1F1A1780" width={36} allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, "Visitas"]} contentStyle={tooltipStyle} cursor={{ fill: "#00000008" }} />
        <Bar dataKey="visitas" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === peakHour ? RED : `${INK}33`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopCartChart({ data }: { data: { name: string; agregados: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#1F1A17"
          width={150}
        />
        <Tooltip
          formatter={(v: number) => [v, "Veces al carrito"]}
          contentStyle={tooltipStyle}
          cursor={{ fill: "#00000008" }}
        />
        <Bar dataKey="agregados" fill={GOLD} radius={[0, 8, 8, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
