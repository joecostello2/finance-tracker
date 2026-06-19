import type {
  AllocationInput,
  AllocationItem,
  AllocationPlan,
  BillDTO,
  GoalDTO,
  LoanForAllocation,
} from "./types";

// --- Tuning knobs (kept here so the policy is easy to find and adjust) ---
const AVG_DAYS_PER_MONTH = 30.4;
// Of the money left after bills + savings goals, this share is suggested toward
// extra debt paydown; the rest becomes discretionary.
const EXTRA_DEBT_SHARE = 0.5;
// For a goal with no monthly target and no deadline, suggest up to this share of
// the remaining (post-bills) funds.
const UNTARGETED_GOAL_SHARE = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00Z");
}
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** The end of the allocation window: when the next paycheck is expected. */
export function nextPayDate(payDate: Date, frequency: string): Date {
  switch (frequency) {
    case "WEEKLY":
      return addDays(payDate, 7);
    case "SEMIMONTHLY":
      return addDays(payDate, 15);
    case "MONTHLY":
      return addMonths(payDate, 1);
    case "ONE_TIME":
      return addDays(payDate, 14); // treat a one-off as a two-week window
    case "BIWEEKLY":
    default:
      return addDays(payDate, 14);
  }
}

function advanceBill(d: Date, frequency: string): Date {
  switch (frequency) {
    case "WEEKLY":
      return addDays(d, 7);
    case "BIWEEKLY":
      return addDays(d, 14);
    case "SEMIMONTHLY":
      return addDays(d, 15);
    case "QUARTERLY":
      return addMonths(d, 3);
    case "ANNUAL":
      return addMonths(d, 12);
    case "MONTHLY":
    default:
      return addMonths(d, 1);
  }
}

/** Total amount of a bill that comes due within [start, end). */
export function billDueInWindow(
  bill: BillDTO,
  start: Date,
  end: Date,
): { total: number; count: number; firstDue: string | null } {
  const due = parseDate(bill.nextDueDate);

  if (bill.frequency === "ONE_TIME") {
    const inWindow = due >= start && due < end;
    return {
      total: inWindow ? bill.amount : 0,
      count: inWindow ? 1 : 0,
      firstDue: inWindow ? fmtDate(due) : null,
    };
  }

  // Roll the occurrence forward to the first one >= start, then count to end.
  let occ = due;
  let guard = 0;
  while (occ < start && guard < 1000) {
    occ = advanceBill(occ, bill.frequency);
    guard++;
  }
  const firstDue = occ < end ? fmtDate(occ) : null;
  let count = 0;
  while (occ < end && guard < 1000) {
    count++;
    occ = advanceBill(occ, bill.frequency);
    guard++;
  }
  return { total: round2(bill.amount * count), count, firstDue };
}

function pickExtraDebtTarget(
  loans: LoanForAllocation[],
  strategy: string,
): LoanForAllocation | null {
  const open = loans.filter((l) => l.currentBalance > 0);
  if (open.length === 0) return null;
  if (strategy === "SNOWBALL") {
    return [...open].sort((a, b) => a.currentBalance - b.currentBalance)[0];
  }
  // AVALANCHE (default): highest APR first; unknown APR treated as 0.
  return [...open].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];
}

function sortGoals(goals: GoalDTO[]): GoalDTO[] {
  return [...goals].sort((a, b) => {
    if (a.isEmergencyFund !== b.isEmergencyFund) return a.isEmergencyFund ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Suggest how to allocate one paycheck using a priority waterfall:
 *   1. Bills due before the next paycheck
 *   2. This period's share of loan minimum payments
 *   3. Emergency fund, then other savings goals (priority order)
 *   4. Extra debt paydown (avalanche by default)
 *   5. Discretionary (whatever's left)
 */
export function suggestAllocation(input: AllocationInput): AllocationPlan {
  const strategy = input.debtStrategy ?? "AVALANCHE";
  const start = parseDate(input.payDate);
  const end = nextPayDate(start, input.frequency);
  const windowDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const periodFraction = windowDays / AVG_DAYS_PER_MONTH;

  const items: AllocationItem[] = [];
  const notes: string[] = [];
  let remaining = input.paycheckAmount;

  // 1. Bills due in window
  for (const bill of input.bills) {
    const { total, count, firstDue } = billDueInWindow(bill, start, end);
    if (total <= 0) continue;
    items.push({
      category: "BILLS",
      label: bill.name,
      amount: total,
      reason:
        count > 1
          ? `${count}× ${bill.frequency.toLowerCase()} occurrences due before your next paycheck`
          : `Due ${firstDue} — before your next paycheck`,
    });
    remaining -= total;
  }

  // 2. Loan minimum payments (prorated to this pay period)
  const loanMinMonthly = input.loans
    .filter((l) => l.currentBalance > 0 && l.minimumPayment)
    .reduce((s, l) => s + (l.minimumPayment ?? 0), 0);
  const loanMinShare = round2(loanMinMonthly * periodFraction);
  if (loanMinShare > 0) {
    items.push({
      category: "LOAN_MINIMUMS",
      label: "Loan minimum payments",
      amount: loanMinShare,
      reason: `This period's share (${windowDays} of ~30 days) of your ${round2(loanMinMonthly)}/mo minimums`,
    });
    remaining -= loanMinShare;
  }

  // Shortfall: obligations exceed the paycheck.
  let shortfall = 0;
  if (remaining < 0) {
    shortfall = round2(-remaining);
    remaining = 0;
    notes.push(
      `Your required obligations this period exceed this paycheck by ${shortfall.toFixed(
        2,
      )}. Cover the gap from savings or another paycheck.`,
    );
  }

  // 3. Emergency fund, then savings goals
  if (remaining > 0) {
    for (const goal of sortGoals(input.goals)) {
      if (remaining <= 0) break;
      const need = round2(goal.targetAmount - goal.currentAmount);
      if (need <= 0) continue;

      let monthly: number;
      let basis: string;
      if (goal.monthlyTarget && goal.monthlyTarget > 0) {
        monthly = goal.monthlyTarget;
        basis = `toward your ${monthly}/mo target`;
      } else if (goal.deadline) {
        const months = Math.max(
          1,
          Math.round((parseDate(goal.deadline).getTime() - start.getTime()) / DAY_MS / AVG_DAYS_PER_MONTH),
        );
        monthly = need / months;
        basis = `to reach ${goal.targetAmount} by ${goal.deadline}`;
      } else {
        monthly = (remaining / periodFraction) * UNTARGETED_GOAL_SHARE;
        basis = `no monthly target set — suggesting ${Math.round(UNTARGETED_GOAL_SHARE * 100)}% of remaining funds`;
      }

      const perPeriod = monthly * periodFraction;
      const contribution = round2(Math.min(perPeriod, need, remaining));
      if (contribution <= 0) continue;

      items.push({
        category: goal.isEmergencyFund ? "EMERGENCY_FUND" : "SAVINGS_GOAL",
        label: goal.name,
        amount: contribution,
        reason: `${goal.isEmergencyFund ? "Emergency fund — " : ""}${basis}`,
        goalId: goal.id,
      });
      remaining -= contribution;
    }
  }

  // 4. Extra debt paydown (avalanche/snowball)
  if (remaining > 0 && strategy !== "MINIMUMS") {
    const target = pickExtraDebtTarget(input.loans, strategy);
    if (target) {
      const extra = round2(Math.min(remaining * EXTRA_DEBT_SHARE, remaining, target.currentBalance));
      if (extra > 0) {
        const why =
          strategy === "SNOWBALL"
            ? "smallest balance (snowball)"
            : `highest APR${target.interestRate != null ? ` (${target.interestRate}%)` : ""} (avalanche)`;
        items.push({
          category: "EXTRA_DEBT",
          label: `Extra toward ${target.name}`,
          amount: extra,
          reason: `Targets your ${why} to save on interest`,
          loanId: target.id,
        });
        remaining -= extra;
      }
    }
  }

  // 5. Discretionary
  const discretionary = round2(Math.max(0, remaining));
  if (discretionary > 0) {
    items.push({
      category: "DISCRETIONARY",
      label: "Discretionary / spending",
      amount: discretionary,
      reason: "Whatever's left after obligations, savings, and debt — yours to spend",
    });
  }

  const totalAllocated = round2(items.reduce((s, i) => s + i.amount, 0));

  return {
    paycheckAmount: input.paycheckAmount,
    windowStart: fmtDate(start),
    windowEnd: fmtDate(end),
    items,
    totalAllocated,
    discretionary,
    shortfall,
    notes,
  };
}
