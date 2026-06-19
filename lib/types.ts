// Plain, serializable shapes passed from Server Components to Client Components.
// (Prisma Decimal/Date values aren't directly serializable, so queries map to these.)

export type AccountDTO = {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  balance: number;
  currency: string;
};

export type LoanDTO = {
  id: string;
  name: string;
  lender: string | null;
  type: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number | null;
  minimumPayment: number | null;
  currency: string;
  termMonths: number | null;
  startDate: string | null;
};

export type NetWorthSummary = {
  assets: number;
  liabilities: number;
  netWorth: number;
  accountCount: number;
  loanCount: number;
};

export type HistoryPoint = {
  date: string; // YYYY-MM-DD
  assets: number;
  liabilities: number;
  netWorth: number;
};

export type AllocationSlice = {
  label: string;
  value: number;
};

export type PaycheckDTO = {
  id: string;
  source: string | null;
  amount: number;
  date: string; // YYYY-MM-DD
  frequency: string;
  notes: string | null;
};

export type BillDTO = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  nextDueDate: string; // YYYY-MM-DD
  category: string | null;
  autopay: boolean;
};

export type GoalDTO = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyTarget: number | null;
  priority: number;
  isEmergencyFund: boolean;
  deadline: string | null; // YYYY-MM-DD
};

// --- Allocation engine I/O ---

export type LoanForAllocation = {
  id: string;
  name: string;
  currentBalance: number;
  interestRate: number | null;
  minimumPayment: number | null;
};

export type AllocationInput = {
  paycheckAmount: number;
  payDate: string; // YYYY-MM-DD
  frequency: string; // PayFrequency
  bills: BillDTO[];
  loans: LoanForAllocation[];
  goals: GoalDTO[];
  debtStrategy?: "AVALANCHE" | "SNOWBALL" | "MINIMUMS";
};

export type AllocationCategory =
  | "BILLS"
  | "LOAN_MINIMUMS"
  | "EMERGENCY_FUND"
  | "SAVINGS_GOAL"
  | "EXTRA_DEBT"
  | "DISCRETIONARY";

export type AllocationItem = {
  category: AllocationCategory;
  label: string;
  amount: number;
  reason: string;
  // For items that map to a record we can apply (goal contribution, etc.)
  goalId?: string;
  loanId?: string;
};

export type AllocationPlan = {
  paycheckAmount: number;
  windowStart: string;
  windowEnd: string;
  items: AllocationItem[];
  totalAllocated: number;
  discretionary: number;
  shortfall: number; // > 0 when bills exceed the paycheck
  notes: string[];
};

// --- Expenses & spending analytics ---

export type ExpenseDTO = {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string | null;
  categoryColor: string | null;
  accountName: string | null;
};

export type CategorySpend = {
  category: string;
  color: string;
  amount: number;
  pct: number; // share of this period's total (0..100)
  count: number;
  prevAmount: number;
  deltaPct: number | null; // % change vs previous period; null if no prior spend
};

export type SpendingBreakdown = {
  label: string;
  total: number;
  prevTotal: number;
  txnCount: number;
  byCategory: CategorySpend[];
  topCategories: CategorySpend[];
  insights: string[];
};
