"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { RowActions } from "@/components/RowActions";
import { formatMoney } from "@/lib/money";
import type { LoanDTO } from "@/lib/types";
import { createLoan, updateLoan, deleteLoan, type FormState } from "./actions";

const TYPE_OPTIONS = [
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "AUTO", label: "Auto" },
  { value: "STUDENT", label: "Student" },
  { value: "PERSONAL", label: "Personal" },
  { value: "CREDIT_LINE", label: "Credit line" },
  { value: "OTHER", label: "Other" },
];
const LABELS = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

export default function LoansManager({ loans }: { loans: LoanDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<LoanDTO | null>(null);
  const [creating, setCreating] = useState(false);

  const open = creating || editing !== null;
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loans &amp; debts</h1>
          <p className="text-sm text-slate-500">Mortgages, auto, student, and personal loans.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Add loan</button>
      </div>

      {loans.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-slate-500">No loans tracked yet.</p>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Add your first loan</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {loans.map((l) => {
            const paid = l.originalAmount > 0 ? Math.min(1, Math.max(0, (l.originalAmount - l.currentBalance) / l.originalAmount)) : 0;
            return (
              <div key={l.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {LABELS[l.type] ?? l.type}{l.lender ? ` · ${l.lender}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <RowActions
                      onEdit={() => setEditing(l)}
                      onDelete={async () => {
                        await deleteLoan(l.id);
                        router.refresh();
                      }}
                      deleteLabel={`"${l.name}"`}
                    />
                  </div>
                </div>

                <p className="mt-3 text-2xl font-semibold tabular-nums text-[--color-negative]">
                  {formatMoney(l.currentBalance, l.currency)}
                </p>
                <p className="text-xs text-slate-400">remaining of {formatMoney(l.originalAmount, l.currency)}</p>

                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[--color-positive]" style={{ width: `${paid * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{Math.round(paid * 100)}% paid off</p>
                </div>

                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  {l.interestRate != null && <span>{l.interestRate}% APR</span>}
                  {l.minimumPayment != null && <span>{formatMoney(l.minimumPayment, l.currency)}/mo</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing ? "Edit loan" : "Add loan"}>
        <LoanForm
          key={editing?.id ?? "new"}
          loan={editing}
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function LoanForm({ loan, onSuccess }: { loan: LoanDTO | null; onSuccess: () => void }) {
  const action = loan ? updateLoan.bind(null, loan.id) : createLoan;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Loan name</label>
        <input id="name" name="name" required defaultValue={loan?.name} className="input" placeholder="e.g. Home mortgage" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={loan?.type ?? "PERSONAL"} className="input">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lender">Lender</label>
          <input id="lender" name="lender" defaultValue={loan?.lender ?? ""} className="input" placeholder="Optional" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="originalAmount">Original amount</label>
          <input id="originalAmount" name="originalAmount" type="number" step="0.01" required defaultValue={loan?.originalAmount ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="currentBalance">Current balance</label>
          <input id="currentBalance" name="currentBalance" type="number" step="0.01" required defaultValue={loan?.currentBalance ?? ""} className="input" placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="interestRate">APR %</label>
          <input id="interestRate" name="interestRate" type="number" step="0.001" defaultValue={loan?.interestRate ?? ""} className="input" placeholder="6.25" />
        </div>
        <div>
          <label className="label" htmlFor="minimumPayment">Min / mo</label>
          <input id="minimumPayment" name="minimumPayment" type="number" step="0.01" defaultValue={loan?.minimumPayment ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="termMonths">Term (mo)</label>
          <input id="termMonths" name="termMonths" type="number" defaultValue={loan?.termMonths ?? ""} className="input" placeholder="360" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="startDate">Start date</label>
          <input id="startDate" name="startDate" type="date" defaultValue={loan?.startDate ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <input id="currency" name="currency" maxLength={3} defaultValue={loan?.currency ?? "USD"} className="input uppercase" />
        </div>
      </div>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton>{loan ? "Save changes" : "Add loan"}</SubmitButton>
      </div>
    </form>
  );
}

