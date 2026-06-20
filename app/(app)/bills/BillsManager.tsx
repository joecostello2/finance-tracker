"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { RowActions } from "@/components/RowActions";
import { formatMoney } from "@/lib/money";
import type { BillDTO } from "@/lib/types";
import { createBill, updateBill, deleteBill, type FormState } from "./actions";

const FREQ_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "SEMIMONTHLY", label: "Twice a month" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "ONE_TIME", label: "One-time" },
];
const FREQ_LABELS = Object.fromEntries(FREQ_OPTIONS.map((o) => [o.value, o.label]));
const PER_MONTH: Record<string, number> = {
  WEEKLY: 52 / 12, BIWEEKLY: 26 / 12, SEMIMONTHLY: 2, MONTHLY: 1, QUARTERLY: 1 / 3, ANNUAL: 1 / 12, ONE_TIME: 0,
};

export default function BillsManager({ bills }: { bills: BillDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BillDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const open = creating || editing !== null;
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const monthlyTotal = bills.reduce((s, b) => s + b.amount * (PER_MONTH[b.frequency] ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="text-sm text-slate-500">Recurring obligations the planner reserves money for.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Add bill</button>
      </div>

      {monthlyTotal > 0 && (
        <div className="card mb-6 p-5">
          <p className="text-sm text-slate-500">Estimated monthly bills</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-negative">{formatMoney(monthlyTotal)}</p>
          <p className="text-xs text-slate-400">Loan minimum payments are added automatically in the planner.</p>
        </div>
      )}

      {bills.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-slate-500">No bills yet.</p>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Add your first bill</button>
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {bills.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {b.name}
                  {b.autopay && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">AUTOPAY</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {FREQ_LABELS[b.frequency] ?? b.frequency}
                  {b.category ? ` · ${b.category}` : ""}
                  {" · next "}
                  {new Date(b.nextDueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-semibold text-slate-900">{formatMoney(b.amount)}</span>
                <RowActions
                  onEdit={() => setEditing(b)}
                  onDelete={async () => {
                    await deleteBill(b.id);
                    router.refresh();
                  }}
                  deleteLabel={`"${b.name}"`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing ? "Edit bill" : "Add bill"}>
        <BillForm
          key={editing?.id ?? "new"}
          bill={editing}
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

function BillForm({ bill, onSuccess }: { bill: BillDTO | null; onSuccess: () => void }) {
  const action = bill ? updateBill.bind(null, bill.id) : createBill;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Bill name</label>
        <input id="name" name="name" required defaultValue={bill?.name} className="input" placeholder="e.g. Rent" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" name="amount" type="number" step="0.01" required defaultValue={bill?.amount ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="frequency">Frequency</label>
          <select id="frequency" name="frequency" defaultValue={bill?.frequency ?? "MONTHLY"} className="input">
            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="nextDueDate">Next due date</label>
          <input id="nextDueDate" name="nextDueDate" type="date" required defaultValue={bill?.nextDueDate ?? todayStr()} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <input id="category" name="category" defaultValue={bill?.category ?? ""} className="input" placeholder="e.g. Housing" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="autopay" defaultChecked={bill?.autopay} className="h-4 w-4 rounded border-slate-300" />
        On autopay
      </label>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end pt-2">
        <SubmitButton>{bill ? "Save changes" : "Add bill"}</SubmitButton>
      </div>
    </form>
  );
}
