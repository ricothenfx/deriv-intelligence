"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

export function TrendChart({ data }: { data: { bucket: string; mentions: number; sentiment: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#475569" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: string) => String(v).slice(5)} />
        <YAxis yAxisId="l" tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
        <YAxis yAxisId="r" orientation="right" domain={[-1, 1]} tick={{ fill: "#64748b", fontSize: 10 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area yAxisId="l" dataKey="mentions" name="mentions" stroke="#64748b" fill="url(#mGrad)" />
        <Line yAxisId="r" dataKey="sentiment" name="sentiment (weighted)" stroke="#22c55e" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function HourlyChart({ data }: { data: { hour: number; mentions: number; sentiment: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}h`} tick={{ fill: "#64748b", fontSize: 10 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="mentions" name="mentions" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.sentiment < -0.1 ? "#ef4444" : d.sentiment > 0.1 ? "#22c55e" : "#475569"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
