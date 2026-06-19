"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/money";
import type { CategorySpend } from "@/lib/types";

export default function SpendingDonut({ data, total }: { data: CategorySpend[]; total: number }) {
  if (data.length === 0) {
    return <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">No spending to chart yet.</div>;
  }
  return (
    <div className="relative" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="category" innerRadius={62} outerRadius={90} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.category} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => {
              const p = (item?.payload as CategorySpend | undefined)?.pct;
              return [`${formatMoney(Number(value))}${p != null ? ` · ${p}%` : ""}`, (item?.payload as CategorySpend)?.category ?? ""];
            }}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-slate-400">Total</span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
      </div>
    </div>
  );
}
