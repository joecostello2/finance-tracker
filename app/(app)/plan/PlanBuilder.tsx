"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { suggestAllocation } from "@/lib/allocation";
import type { BillDTO, GoalDTO, LoanForAllocation, AllocationCategory } from "@/lib/types";
import { applyPlan } from "./actions";

const FREQ_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "SEMIMONTHLY", label: "Twice a month" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONE_TIME", label: "One-time" },
];

const CATEGORY_META: Record<AllocationCategory, { label: string; color: string; chip: string }> = {
  BILLS: { label: "Bills", color: "#ef4444", chip: "bg-red-100 text-red-700" },
  LOAN_MINIMUMS: { label: "Loan minimums", color: "#f97316", chip: "bg-orange-100 text-orange-700" },
  EMERGENCY_FUND: { label: "Emergency fund", color: "#f59e0b", chip: "bg-amber-100 text-amber-700" },
  SAVINGS_GOAL: { label: "Savings goals", color: "#4f46e5", chip: "bg-indigo-100 text-indigo-700" },
  EXTRA_DEBT: { label: "Extra debt paydown", color: "#8b5cf6", chip: "bg-violet-100 text-violet-700" },
  DISCRETIONARY: { label: "Discretionary", color: "#10b981", chip: "bg-emerald-100 text-emerald-700" },
};
const CATEGORY_ORDER: AllocationCategory[] = [
  "BILLS",
  "LOAN_MINIMUMS",
  "EMERGENCY_FUND",
  "SAVINGS_GOAL",
  "EXTRA_DEBT",
  "DISCRETIONARY",
];

type Props = {
  bills: BillDTO[];
  loans: LoanForAllocation[];
  goals: GoalDTO[];
  defaultAmount: number;
  defaultFrequency: string;
  defaultSource: string;
  debtStrategy: "AVALANCHE" | "SNOWBALL" | "MINIMUMS";
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PlanBuilder({
  bills,
  loans,
  goals,
  defaultAmount,
  defaultFrequency,
  defaultSource,
  debtStrategy,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [date, setDate] = useState(todayStr());
  const [frequency, setFrequency] = useState(defaultFrequency || "BIWEEKLY");
  const [source, setSource] = useState(defaultSource || "");
  const [logPaycheck, setLogPaycheck] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const numericAmount = Number(amount) || 0;

  const plan = useMemo(() => {
    if (numericAmount <= 0) return null;
    return suggestAllocation({
      paycheckAmount: numericAmount,
      payDate: date,
      frequency,
      bills,
      loans,
      goals,
      debtStrategy,
    });
  }, [numericAmount, date, frequency, bills, loans, goals, debtStrategy]);

  const grouped = useMemo(() => {
    if (!plan) return [];
    return CATEGORY_ORDER.map((cat) => {
      const items = plan.items.filter((i) => i.category === cat);
      const total = items.reduce((s, i) => s + i.amount, 0);
      return { cat, items, total };
    }).filter((g) => g.items.length > 0);
  }, [plan]);

  function onApply() {
    if (!plan) return;
    const goalContributions = plan.items
      .filter((i) => (i.category === "EMERGENCY_FUND" || i.category === "SAVINGS_GOAL") && i.goalId)
      .map((i) => ({ goalId: i.goalId!, amount: i.amount }));

    startTransition(async () => {
      const res = await applyPlan({
        goalContributions,
        logPaycheck: logPaycheck
          ? { amount: numericAmount, date, frequency: frequency as "BIWEEKLY", source: source || undefined }
          : undefined,
      });
      if (res.ok) {
        setApplied(res.message ?? "Applied.");
        router.refresh();
      } else {
        setApplied(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Allocate a paycheck</h1>
        <p className="text-sm text-slate-500">
          Enter a paycheck and get a suggested split: bills first, then savings, then extra debt, then discretionary.
        </p>
      </div>

      {/* Inputs */}
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="amount">Paycheck amount</label>
            <input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00" />
          </div>
          <div>
            <label className="label" htmlFor="date">Pay date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="frequency">Frequency</label>
            <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input">
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="source">Source</label>
            <input id="source" value={source} onChange={(e) => setSource(e.target.value)} className="input" placeholder="Optional" />
          </div>
        </div>
      </div>

      {!plan ? (
        <div className="card px-6 py-12 text-center text-slate-400">
          Enter a paycheck amount above to see a suggested allocation.
        </div>
      ) : (
        <>
          {plan.shortfall > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ⚠️ This paycheck doesn&apos;t fully cover your obligations this period — short by{" "}
              <strong>{formatMoney(plan.shortfall)}</strong>. Cover the gap from savings or another paycheck.
            </div>
          )}

          {/* Proportional bar */}
          <div>
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {grouped.map((g) => (
                <div
                  key={g.cat}
                  style={{ width: `${(g.total / plan.paycheckAmount) * 100}%`, background: CATEGORY_META[g.cat].color }}
                  title={`${CATEGORY_META[g.cat].label}: ${formatMoney(g.total)}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Window: {plan.windowStart} → {plan.windowEnd} · Allocating {formatMoney(plan.paycheckAmount)}
            </p>
          </div>

          {/* Grouped breakdown */}
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.cat} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-slate-50/60 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[g.cat].color }} />
                    <span className="font-medium">{CATEGORY_META[g.cat].label}</span>
                    <span className="text-xs text-slate-400">{Math.round((g.total / plan.paycheckAmount) * 100)}%</span>
                  </div>
                  <span className="tabular-nums font-semibold">{formatMoney(g.total)}</span>
                </div>
                <ul className="divide-y divide-border">
                  {g.items.map((item, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.reason}</p>
                      </div>
                      <span className="shrink-0 tabular-nums text-sm">{formatMoney(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Apply */}
          <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={logPaycheck} onChange={(e) => setLogPaycheck(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Also log this paycheck to my income
            </label>
            <div className="flex items-center gap-3">
              {applied && <span className="text-sm text-positive">{applied}</span>}
              <button className="btn-primary" onClick={onApply} disabled={pending}>
                {pending ? "Applying…" : "Apply plan"}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Applying funds your savings goals by the suggested amounts{" "}
            {logPaycheck ? "and records this paycheck" : ""}. Bills and debt payments are suggestions — pay them as you normally would.
          </p>
        </>
      )}
    </div>
  );
}
