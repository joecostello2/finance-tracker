"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { RowActions } from "@/components/RowActions";
import { formatMoney } from "@/lib/money";
import { DEFAULT_CATEGORIES, suggestCategory } from "@/lib/categorize";
import { PERIOD_OPTIONS } from "@/lib/period";
import type { ExpenseDTO, SpendingBreakdown } from "@/lib/types";
import { createExpense, updateExpense, deleteExpense, type FormState } from "./actions";

// Recharts is heavy; load the donut only on the client.
const SpendingDonutLazy = dynamic(() => import("./SpendingDonut"), {
  ssr: false,
  loading: () => <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">Loading chart…</div>,
});

type Props = {
  breakdown: SpendingBreakdown;
  expenses: ExpenseDTO[];
  categories: { name: string; color: string | null }[];
  periodKey: string;
};

export default function ExpensesManager({ breakdown, expenses, categories, periodKey }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<ExpenseDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const open = creating || editing !== null;
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  // Category names for the picker: user's categories + the standard set.
  const categoryNames = useMemo(() => {
    const set = new Set<string>(categories.map((c) => c.name));
    for (const c of DEFAULT_CATEGORIES) set.add(c.name);
    return [...set].sort();
  }, [categories]);

  const maxCat = breakdown.byCategory[0]?.amount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-500">See where your money goes and what to trim.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Add expense</button>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-[--color-border] bg-white p-1 text-sm">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.value}
            onClick={() => router.push(`/expenses?period=${p.value}`)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              periodKey === p.value ? "bg-[--color-brand] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {breakdown.total === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-slate-500">No expenses logged for {breakdown.label.toLowerCase()}.</p>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Add your first expense</button>
        </div>
      ) : (
        <>
          {/* Summary + breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold">Where it went</h2>
                <span className="text-xs text-slate-400">{breakdown.txnCount} expenses · {breakdown.label}</span>
              </div>
              <SpendingDonutLazy data={breakdown.byCategory} total={breakdown.total} />
            </div>

            <div className="card p-5">
              <h2 className="mb-3 font-semibold">By category</h2>
              <ul className="space-y-3">
                {breakdown.byCategory.map((c) => (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        {c.category}
                        <span className="text-xs text-slate-400">{c.pct}%</span>
                        <DeltaChip delta={c.deltaPct} />
                      </span>
                      <span className="tabular-nums font-medium">{formatMoney(c.amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${maxCat > 0 ? (c.amount / maxCat) * 100 : 0}%`, background: c.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Insights */}
          {breakdown.insights.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 font-semibold">Insights</h2>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {breakdown.insights.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[--color-brand]">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Expense list */}
      <div>
        <h2 className="mb-3 font-semibold">Transactions</h2>
        {expenses.length === 0 ? (
          <div className="card px-5 py-8 text-center text-sm text-slate-400">No expenses in this period.</div>
        ) : (
          <div className="card divide-y divide-[--color-border]">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="truncate text-xs text-slate-500">
                    {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {e.category && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: e.categoryColor ?? "#94a3b8" }} />
                        {e.category}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold">{formatMoney(e.amount)}</span>
                  <RowActions
                    onEdit={() => setEditing(e)}
                    onDelete={async () => {
                      await deleteExpense(e.id);
                      router.refresh();
                    }}
                    deleteLabel={`"${e.description}"`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={close} title={editing ? "Edit expense" : "Add expense"}>
        <ExpenseForm
          key={editing?.id ?? "new"}
          expense={editing}
          categoryNames={categoryNames}
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null || Math.abs(delta) < 1) return null;
  const up = delta > 0;
  // For spending, up is "bad" (red), down is "good" (green).
  return (
    <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${up ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta)}%
    </span>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ExpenseForm({
  expense,
  categoryNames,
  onSuccess,
}: {
  expense: ExpenseDTO | null;
  categoryNames: string[];
  onSuccess: () => void;
}) {
  const action = expense ? updateExpense.bind(null, expense.id) : createExpense;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState(expense?.category ?? "");

  // Live auto-categorization hint while the user types (only when no manual pick).
  const suggestion = useMemo(() => (description.trim() ? suggestCategory(description) : null), [description]);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="description">Description / merchant</label>
        <input
          id="description"
          name="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
          placeholder="e.g. Starbucks, Shell gas, Amazon"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" name="amount" type="number" step="0.01" required defaultValue={expense?.amount ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" required defaultValue={expense?.date ?? todayStr()} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="category">Category</label>
        <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input">
          <option value="">Auto-detect{suggestion ? ` (→ ${suggestion})` : ""}</option>
          {categoryNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {!category && suggestion && (
          <p className="mt-1 text-xs text-slate-400">Will be categorized as <strong>{suggestion}</strong> based on the description.</p>
        )}
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end pt-2">
        <SubmitButton>{expense ? "Save changes" : "Add expense"}</SubmitButton>
      </div>
    </form>
  );
}
