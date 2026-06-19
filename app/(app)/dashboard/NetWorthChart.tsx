"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import type { HistoryPoint } from "@/lib/types";

export default function NetWorthChart({
  data,
  currency,
}: {
  data: HistoryPoint[];
  currency: string;
}) {
  // A single data point won't render a line nicely; duplicate it so the area shows.
  const series =
    data.length === 1 ? [{ ...data[0], date: data[0].date + " " }, data[0]] : data;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
          tickFormatter={(d: string) =>
            new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          }
        />
        <YAxis
          width={56}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatMoneyCompact(v, currency)}
        />
        <Tooltip
          formatter={(value) => [formatMoney(Number(value), currency), "Net worth"]}
          labelFormatter={(d) =>
            new Date(d as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          }
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Area
          type="monotone"
          dataKey="netWorth"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#nw)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
