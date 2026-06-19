import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  getNetWorthSummary,
  getNetWorthHistory,
  getAssetAllocation,
  getCashFlowSummary,
} from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import NetWorthChart from "./NetWorthChart";
import AllocationChart from "./AllocationChart";

const CURRENCY = "USD";

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, history, allocation, cashFlow] = await Promise.all([
    getNetWorthSummary(user.id),
    getNetWorthHistory(user.id),
    getAssetAllocation(user.id),
    getCashFlowSummary(user.id),
  ]);

  const hasCashFlow = cashFlow.monthlyIncome > 0 || cashFlow.monthlyBills > 0 || cashFlow.monthlyLoanMinimums > 0;

  const empty = summary.accountCount === 0 && summary.loanCount === 0;
  const firstName = (user.name || "there").split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-sm text-slate-500">Here&apos;s where your money stands today.</p>
      </div>

      {empty ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="max-w-sm text-slate-500">
            Your dashboard is empty. Add your bank accounts and loans to see your net worth and trends.
          </p>
          <div className="flex gap-3">
            <Link href="/accounts" className="btn-primary">Add an account</Link>
            <Link href="/loans" className="btn-ghost">Add a loan</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Net worth"
              value={formatMoney(summary.netWorth, CURRENCY)}
              accent={summary.netWorth >= 0 ? "text-slate-900" : "text-[--color-negative]"}
              big
            />
            <StatCard label="Assets" value={formatMoney(summary.assets, CURRENCY)} accent="text-[--color-positive]" />
            <StatCard label="Liabilities" value={formatMoney(summary.liabilities, CURRENCY)} accent="text-[--color-negative]" />
          </div>

          {hasCashFlow && (
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Monthly cash flow</h2>
                <Link href="/plan" className="text-sm font-medium text-[--color-brand] hover:underline">
                  Plan a paycheck →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <CashStat label="Income" value={formatMoney(cashFlow.monthlyIncome, CURRENCY)} accent="text-[--color-positive]" />
                <CashStat label="Bills" value={formatMoney(cashFlow.monthlyBills, CURRENCY)} accent="text-slate-900" />
                <CashStat label="Loan minimums" value={formatMoney(cashFlow.monthlyLoanMinimums, CURRENCY)} accent="text-slate-900" />
                <CashStat
                  label="Leftover"
                  value={formatMoney(cashFlow.leftover, CURRENCY)}
                  accent={cashFlow.leftover >= 0 ? "text-[--color-positive]" : "text-[--color-negative]"}
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Estimated recurring monthly figures. &ldquo;Leftover&rdquo; is what&apos;s free for savings, debt, and spending.
              </p>
            </div>
          )}

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Net worth over time</h2>
              <span className="text-xs text-slate-400">
                {summary.accountCount} accounts · {summary.loanCount} loans
              </span>
            </div>
            <NetWorthChart data={history} currency={CURRENCY} />
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Asset allocation</h2>
            <AllocationChart data={allocation} currency={CURRENCY} />
          </div>
        </>
      )}
    </div>
  );
}

function CashStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "text-slate-900",
  big = false,
}: {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${big ? "text-3xl" : "text-2xl"} ${accent}`}>{value}</p>
    </div>
  );
}
