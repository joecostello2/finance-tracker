"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { RowActions } from "@/components/RowActions";
import { formatMoney } from "@/lib/money";
import type { GoalDTO } from "@/lib/types";
import { createGoal, updateGoal, deleteGoal, contributeToGoal, type FormState } from "./actions";

export default function GoalsManager({ goals }: { goals: GoalDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoalDTO | null>(null);
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
          <h1 className="text-2xl font-semibold tracking-tight">Savings goals</h1>
          <p className="text-sm text-slate-500">The planner funds these after your bills, in priority order.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Add goal</button>
      </div>

      {goals.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-slate-500">No savings goals yet.</p>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Add your first goal</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min(1, g.currentAmount / g.targetAmount) : 0;
            const done = g.currentAmount >= g.targetAmount;
            return (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {g.name}
                      {g.isEmergencyFund && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">EMERGENCY</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Priority {g.priority}
                      {g.monthlyTarget != null ? ` · ${formatMoney(g.monthlyTarget)}/mo target` : ""}
                      {g.deadline ? ` · by ${g.deadline}` : ""}
                    </p>
                  </div>
                  <RowActions
                    onEdit={() => setEditing(g)}
                    onDelete={async () => {
                      await deleteGoal(g.id);
                      router.refresh();
                    }}
                    deleteLabel={`"${g.name}"`}
                  />
                </div>

                <p className="mt-3 text-xl font-semibold tabular-nums">
                  {formatMoney(g.currentAmount)}
                  <span className="text-sm font-normal text-slate-400"> / {formatMoney(g.targetAmount)}</span>
                </p>

                <div className="mt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${done ? "bg-[--color-positive]" : "bg-[--color-brand]"}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{Math.round(pct * 100)}% funded{done ? " 🎉" : ""}</p>
                </div>

                <ContributeRow goalId={g.id} onDone={() => router.refresh()} />
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing ? "Edit goal" : "Add savings goal"}>
        <GoalForm
          key={editing?.id ?? "new"}
          goal={editing}
          onSuccess={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function ContributeRow({ goalId, onDone }: { goalId: string; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 flex gap-2">
      <input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="input"
        placeholder="Add funds…"
      />
      <button
        className="btn-ghost shrink-0"
        disabled={busy || !amount}
        onClick={async () => {
          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0) return;
          setBusy(true);
          try {
            await contributeToGoal(goalId, n);
            setAmount("");
            onDone();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Adding…" : "Contribute"}
      </button>
    </div>
  );
}

function GoalForm({ goal, onSuccess }: { goal: GoalDTO | null; onSuccess: () => void }) {
  const action = goal ? updateGoal.bind(null, goal.id) : createGoal;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Goal name</label>
        <input id="name" name="name" required defaultValue={goal?.name} className="input" placeholder="e.g. Emergency fund" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="targetAmount">Target amount</label>
          <input id="targetAmount" name="targetAmount" type="number" step="0.01" required defaultValue={goal?.targetAmount ?? ""} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="currentAmount">Current amount</label>
          <input id="currentAmount" name="currentAmount" type="number" step="0.01" defaultValue={goal?.currentAmount ?? 0} className="input" placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="monthlyTarget">Monthly target</label>
          <input id="monthlyTarget" name="monthlyTarget" type="number" step="0.01" defaultValue={goal?.monthlyTarget ?? ""} className="input" placeholder="Optional" />
        </div>
        <div>
          <label className="label" htmlFor="priority">Priority</label>
          <input id="priority" name="priority" type="number" min={0} defaultValue={goal?.priority ?? 0} className="input" placeholder="0" />
        </div>
        <div>
          <label className="label" htmlFor="deadline">Deadline</label>
          <input id="deadline" name="deadline" type="date" defaultValue={goal?.deadline ?? ""} className="input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isEmergencyFund" defaultChecked={goal?.isEmergencyFund} className="h-4 w-4 rounded border-slate-300" />
        This is my emergency fund (funded before other goals)
      </label>
      <p className="text-xs text-slate-400">Lower priority number = funded earlier. Leave monthly target blank to let the planner suggest an amount.</p>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end pt-2">
        <SubmitButton>{goal ? "Save changes" : "Add goal"}</SubmitButton>
      </div>
    </form>
  );
}
