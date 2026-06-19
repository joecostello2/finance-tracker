import { prisma } from "./prisma";
import { toNumber, LIABILITY_ACCOUNT_TYPES } from "./money";
import type {
  AccountDTO,
  LoanDTO,
  NetWorthSummary,
  HistoryPoint,
  AllocationSlice,
  PaycheckDTO,
  BillDTO,
  GoalDTO,
  LoanForAllocation,
} from "./types";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Monthly-equivalent multipliers, used for the cash-flow summary.
const PAY_PER_MONTH: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMIMONTHLY: 2,
  MONTHLY: 1,
  ONE_TIME: 0, // not recurring
};
const BILL_PER_MONTH: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMIMONTHLY: 2,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  ANNUAL: 1 / 12,
  ONE_TIME: 0,
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit card",
  INVESTMENT: "Investment",
  RETIREMENT: "Retirement",
  CASH: "Cash",
  OTHER: "Other",
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  MORTGAGE: "Mortgage",
  AUTO: "Auto",
  STUDENT: "Student",
  PERSONAL: "Personal",
  CREDIT_LINE: "Credit line",
  OTHER: "Other",
};

export function accountTypeLabel(type: string) {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}
export function loanTypeLabel(type: string) {
  return LOAN_TYPE_LABELS[type] ?? type;
}

export async function getAccounts(userId: string): Promise<AccountDTO[]> {
  const rows = await prisma.account.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    type: a.type,
    balance: toNumber(a.balance),
    currency: a.currency,
  }));
}

export async function getLoans(userId: string): Promise<LoanDTO[]> {
  const rows = await prisma.loan.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    lender: l.lender,
    type: l.type,
    originalAmount: toNumber(l.originalAmount),
    currentBalance: toNumber(l.currentBalance),
    interestRate: l.interestRate === null ? null : toNumber(l.interestRate),
    minimumPayment: l.minimumPayment === null ? null : toNumber(l.minimumPayment),
    currency: l.currency,
    termMonths: l.termMonths,
    startDate: l.startDate ? l.startDate.toISOString().slice(0, 10) : null,
  }));
}

export async function getNetWorthSummary(userId: string): Promise<NetWorthSummary> {
  const [accounts, loans] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { type: true, balance: true } }),
    prisma.loan.findMany({ where: { userId }, select: { currentBalance: true } }),
  ]);

  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    const bal = toNumber(a.balance);
    if (LIABILITY_ACCOUNT_TYPES.has(a.type)) liabilities += bal;
    else assets += bal;
  }
  for (const l of loans) liabilities += toNumber(l.currentBalance);

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    accountCount: accounts.length,
    loanCount: loans.length,
  };
}

/** Allocation of positive assets by account type, for the dashboard breakdown. */
export async function getAssetAllocation(userId: string): Promise<AllocationSlice[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { type: true, balance: true },
  });
  const byType = new Map<string, number>();
  for (const a of accounts) {
    if (LIABILITY_ACCOUNT_TYPES.has(a.type)) continue;
    const bal = toNumber(a.balance);
    if (bal <= 0) continue;
    byType.set(a.type, (byType.get(a.type) ?? 0) + bal);
  }
  return [...byType.entries()]
    .map(([type, value]) => ({ label: accountTypeLabel(type), value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Net worth over time, derived from BalanceSnapshot rows. For each distinct day
 * that has any snapshot, we compute net worth using the most-recent snapshot
 * value known for each account/loan as of that day (carry-forward). If there are
 * no snapshots, falls back to a single point at today's current values.
 */
export async function getNetWorthHistory(userId: string): Promise<HistoryPoint[]> {
  const [accounts, loans] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, type: true } }),
    prisma.loan.findMany({ where: { userId }, select: { id: true } }),
  ]);

  const liabilityAccountIds = new Set(
    accounts.filter((a) => LIABILITY_ACCOUNT_TYPES.has(a.type)).map((a) => a.id),
  );
  const accountIds = accounts.map((a) => a.id);
  const loanIds = loans.map((l) => l.id);

  if (accountIds.length === 0 && loanIds.length === 0) return [];

  const snapshots = await prisma.balanceSnapshot.findMany({
    where: {
      OR: [
        accountIds.length ? { accountId: { in: accountIds } } : undefined,
        loanIds.length ? { loanId: { in: loanIds } } : undefined,
      ].filter(Boolean) as object[],
    },
    orderBy: { date: "asc" },
    select: { date: true, balance: true, accountId: true, loanId: true },
  });

  // No history yet: single point from current summary.
  if (snapshots.length === 0) {
    const summary = await getNetWorthSummary(userId);
    const today = new Date().toISOString().slice(0, 10);
    return [{ date: today, assets: summary.assets, liabilities: summary.liabilities, netWorth: summary.netWorth }];
  }

  // Carry-forward latest known balance per entity across distinct days.
  const latestAccountBal = new Map<string, number>();
  const latestLoanBal = new Map<string, number>();
  const points: HistoryPoint[] = [];

  let i = 0;
  const dayKey = (d: Date) => ymd(d);
  while (i < snapshots.length) {
    const day = dayKey(snapshots[i].date);
    // Apply every snapshot on this day.
    while (i < snapshots.length && dayKey(snapshots[i].date) === day) {
      const s = snapshots[i];
      if (s.accountId) latestAccountBal.set(s.accountId, toNumber(s.balance));
      else if (s.loanId) latestLoanBal.set(s.loanId, toNumber(s.balance));
      i++;
    }
    let assets = 0;
    let liabilities = 0;
    for (const [id, bal] of latestAccountBal) {
      if (liabilityAccountIds.has(id)) liabilities += bal;
      else assets += bal;
    }
    for (const [, bal] of latestLoanBal) liabilities += bal;
    points.push({ date: day, assets, liabilities, netWorth: assets - liabilities });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Cash flow: paychecks, bills, goals
// ---------------------------------------------------------------------------

export async function getPaychecks(userId: string): Promise<PaycheckDTO[]> {
  const rows = await prisma.paycheck.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    source: p.source,
    amount: toNumber(p.amount),
    date: ymd(p.date),
    frequency: p.frequency,
    notes: p.notes,
  }));
}

export async function getLatestPaycheck(userId: string): Promise<PaycheckDTO | null> {
  const p = await prisma.paycheck.findFirst({ where: { userId }, orderBy: { date: "desc" } });
  if (!p) return null;
  return {
    id: p.id,
    source: p.source,
    amount: toNumber(p.amount),
    date: ymd(p.date),
    frequency: p.frequency,
    notes: p.notes,
  };
}

export async function getBills(userId: string): Promise<BillDTO[]> {
  const rows = await prisma.bill.findMany({
    where: { userId },
    orderBy: { nextDueDate: "asc" },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    amount: toNumber(b.amount),
    frequency: b.frequency,
    nextDueDate: ymd(b.nextDueDate),
    category: b.category,
    autopay: b.autopay,
  }));
}

export async function getGoals(userId: string): Promise<GoalDTO[]> {
  const rows = await prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: [{ isEmergencyFund: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: toNumber(g.targetAmount),
    currentAmount: toNumber(g.currentAmount),
    monthlyTarget: g.monthlyTarget === null ? null : toNumber(g.monthlyTarget),
    priority: g.priority,
    isEmergencyFund: g.isEmergencyFund,
    deadline: g.deadline ? ymd(g.deadline) : null,
  }));
}

export async function getLoansForAllocation(userId: string): Promise<LoanForAllocation[]> {
  const rows = await prisma.loan.findMany({
    where: { userId },
    select: { id: true, name: true, currentBalance: true, interestRate: true, minimumPayment: true },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    currentBalance: toNumber(l.currentBalance),
    interestRate: l.interestRate === null ? null : toNumber(l.interestRate),
    minimumPayment: l.minimumPayment === null ? null : toNumber(l.minimumPayment),
  }));
}

export type CashFlowSummary = {
  monthlyIncome: number;
  monthlyBills: number;
  monthlyLoanMinimums: number;
  leftover: number;
};

/** Estimated recurring monthly cash flow for the dashboard. */
export async function getCashFlowSummary(userId: string): Promise<CashFlowSummary> {
  const [paychecks, bills, loans] = await Promise.all([
    prisma.paycheck.findMany({ where: { userId }, orderBy: { date: "desc" }, select: { source: true, amount: true, frequency: true } }),
    prisma.bill.findMany({ where: { userId }, select: { amount: true, frequency: true } }),
    prisma.loan.findMany({ where: { userId }, select: { currentBalance: true, minimumPayment: true } }),
  ]);

  // Use the latest paycheck per source so re-logged paychecks don't double count.
  const latestBySource = new Map<string, { amount: number; frequency: string }>();
  for (const p of paychecks) {
    const key = p.source ?? "__default__";
    if (!latestBySource.has(key)) latestBySource.set(key, { amount: toNumber(p.amount), frequency: p.frequency });
  }
  let monthlyIncome = 0;
  for (const { amount, frequency } of latestBySource.values()) {
    monthlyIncome += amount * (PAY_PER_MONTH[frequency] ?? 0);
  }

  let monthlyBills = 0;
  for (const b of bills) monthlyBills += toNumber(b.amount) * (BILL_PER_MONTH[b.frequency] ?? 0);

  let monthlyLoanMinimums = 0;
  for (const l of loans) {
    if (toNumber(l.currentBalance) > 0 && l.minimumPayment) monthlyLoanMinimums += toNumber(l.minimumPayment);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    monthlyIncome: round2(monthlyIncome),
    monthlyBills: round2(monthlyBills),
    monthlyLoanMinimums: round2(monthlyLoanMinimums),
    leftover: round2(monthlyIncome - monthlyBills - monthlyLoanMinimums),
  };
}
