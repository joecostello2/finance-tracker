"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { RowActions } from "@/components/RowActions";
import { formatMoney } from "@/lib/money";
import type { PaycheckDTO } from "@/lib/types";
import { createPaycheck, updatePaycheck, deletePaycheck, type FormState } from "./actions";

const FREQ_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "SEMIMONTHLY", label: "Twice a month" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONE_TIME", label: "One-time" },
];
const FREQ_LABELS = Object.fromEntries(FREQ_OPTIONS.map((o) => [o.value, o.label]));
const PER_MONTH: Record<string, number> = { WEEKLY: 52 / 12, BIWEEKLY: 26 / 12, SEMIMONTHLY: 2, MONTHLY: 1, ONE_TIME: 0 };

export default function IncomeManager({ paychecks }: { paychecks: PaycheckDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PaycheckDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const open = creating || editing !== null;
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  // Estimated monthly income from the latest paycheck of each source.
  const latestBySource = new Map<string, PaycheckDTO>();
  for (const p of paychecks) {
    const key = p.source ?? "__";
    if (!latestBySource.has(key)) latestBySource.set(key, p);
  }
  const monthlyEstimate = [...latestBySource.values()].reduce(
    (s, p) => s + p.amount * (PER_MONTH[p.frequency] ?? 0),
    0,
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
          <p className="text-sm text-slate-500">Log every paycheck you receive.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Add paycheck</button>
      </div>

      {monthlyEstimate > 0 && (
        <div className="card mb-6 p-5">
          <p className="text-sm text-slate-500">Estimated monthly income</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-positive">
            {formatMoney(monthlyEstimate)}
          </p>
          <p className="text-xs text-slate-400">Based on the latest paycheck from each source.</p>
        </div>
      )}

      {paychecks.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-slate-500">No paychecks logged yet.</p>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Add your first paycheck</button>
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {paychecks.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.source || "Paycheck"}</p>
                <p className="truncate text-xs text-slate-500">
                  {new Date(p.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}{FREQ_LABELS[p.frequency] ?? p.frequency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-semibold text-positive">+{formatMoney(p.amount)}</span>
                <RowActions
                  onEdit={() => setEditing(p)}
                  onDelete={async () => {
                    await deletePaycheck(p.id);
                    router.refresh();
                  }}
                  deleteLabel={`paycheck from ${p.source || "this source"}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing ? "Edit paycheck" : "Add paycheck"}>
        <PaycheckForm
          key={editing?.id ?? "new"}
          paycheck={editing}
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function PaycheckForm({ paycheck, onSuccess }: { paycheck: PaycheckDTO | null; onSuccess: () => void }) {
  const action = paycheck ? updatePaycheck.bind(null, paycheck.id) : createPaycheck;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="amount">Net amount</label>
          <input id="amount" name="amount" type="number" step="0.01" required defaultValue={paycheck?.amount ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="date">Date received</label>
          <input id="date" name="date" type="date" required defaultValue={paycheck?.date ?? todayStr()} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="source">Source</label>
          <input id="source" name="source" defaultValue={paycheck?.source ?? ""} className="input" placeholder="e.g. Acme Corp" />
        </div>
        <div>
          <label className="label" htmlFor="frequency">Frequency</label>
          <select id="frequency" name="frequency" defaultValue={paycheck?.frequency ?? "BIWEEKLY"} className="input">
            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <input id="notes" name="notes" defaultValue={paycheck?.notes ?? ""} className="input" placeholder="Optional" />
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end pt-2">
        <SubmitButton>{paycheck ? "Save changes" : "Add paycheck"}</SubmitButton>
      </div>
    </form>
  );
}
