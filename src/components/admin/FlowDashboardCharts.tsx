"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export function FlowDashboardCharts({ data }: { data: { label: string; value: number }[] }) { return <div className="h-64 w-full"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Interacciones" fill="#c62828" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>; }
