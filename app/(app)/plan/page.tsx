import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getBills, getGoals, getLoansForAllocation, getLatestPaycheck } from "@/lib/queries";
import PlanBuilder from "./PlanBuilder";

// The user chose the avalanche strategy (highest-APR loan first) for extra debt.
const DEBT_STRATEGY = "AVALANCHE" as const;

export default async function PlanPage() {
  const user = await requireUser();
  const [bills, goals, loans, latest] = await Promise.all([
    getBills(user.id),
    getGoals(user.id),
    getLoansForAllocation(user.id),
    getLatestPaycheck(user.id),
  ]);

  const hasInputs = bills.length > 0 || goals.length > 0 || loans.length > 0;

  return (
    <div className="space-y-4">
      <PlanBuilder
        bills={bills}
        loans={loans}
        goals={goals}
        defaultAmount={latest?.amount ?? 0}
        defaultFrequency={latest?.frequency ?? "BIWEEKLY"}
        defaultSource={latest?.source ?? ""}
        debtStrategy={DEBT_STRATEGY}
      />

      {!hasInputs && (
        <div className="card p-5 text-sm text-slate-500">
          Tip: add your <Link href="/bills" className="text-brand hover:underline">bills</Link>,{" "}
          <Link href="/loans" className="text-brand hover:underline">loans</Link>, and{" "}
          <Link href="/goals" className="text-brand hover:underline">savings goals</Link> so the planner can
          tailor its suggestions to your situation.
        </div>
      )}
    </div>
  );
}
