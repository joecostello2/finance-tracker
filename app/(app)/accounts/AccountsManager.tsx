"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { formatMoney } from "@/lib/money";
import type { AccountDTO } from "@/lib/types";
import { createAccount, updateAccount, deleteAccount, type FormState } from "./actions";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "CHECKING", label: "Checking" },
  { value: "SAVINGS", label: "Savings" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "OTHER", label: "Other" },
];
const LABELS = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));
const LIABILITY = new Set(["CREDIT_CARD"]);

export default function AccountsManager({ accounts }: { accounts: AccountDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountDTO | null>(null);
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
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-slate-500">Cash, savings, investments, and credit cards.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Add account
        </button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState onAdd={() => setCreating(true)} />
      ) : (
        <div className="card divide-y divide-[--color-border]">
          {accounts.map((a) => {
            const isLiability = LIABILITY.has(a.type);
            return (
              <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {LABELS[a.type] ?? a.type}
                    {a.institution ? ` · ${a.institution}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`tabular-nums font-semibold ${
                      isLiability ? "text-[--color-negative]" : "text-slate-900"
                    }`}
                  >
                    {isLiability ? "−" : ""}
                    {formatMoney(a.balance, a.currency)}
                  </span>
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setEditing(a)}
                    aria-label={`Edit ${a.name}`}
                  >
                    <EditIcon />
                  </button>
                  <DeleteButton id={a.id} name={a.name} onDone={() => router.refresh()} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing ? "Edit account" : "Add account"}>
        <AccountForm
          key={editing?.id ?? "new"}
          account={editing}
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function AccountForm({ account, onSuccess }: { account: AccountDTO | null; onSuccess: () => void }) {
  const action = account
    ? updateAccount.bind(null, account.id)
    : createAccount;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Account name</label>
        <input id="name" name="name" required defaultValue={account?.name} className="input" placeholder="e.g. Chase Checking" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={account?.type ?? "CHECKING"} className="input">
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="institution">Institution</label>
          <input id="institution" name="institution" defaultValue={account?.institution ?? ""} className="input" placeholder="Optional" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="balance">Current balance</label>
          <input id="balance" name="balance" type="number" step="0.01" required defaultValue={account?.balance ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <input id="currency" name="currency" maxLength={3} defaultValue={account?.currency ?? "USD"} className="input uppercase" />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Tip: for a credit card, enter the balance you owe as a positive number.
      </p>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton>{account ? "Save changes" : "Add account"}</SubmitButton>
      </div>
    </form>
  );
}

function DeleteButton({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      disabled={busy}
      aria-label={`Delete ${name}`}
      onClick={async () => {
        if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
        setBusy(true);
        await deleteAccount(id);
        onDone();
      }}
    >
      <TrashIcon />
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-slate-500">No accounts yet.</p>
      <button className="btn-primary" onClick={onAdd}>+ Add your first account</button>
    </div>
  );
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
