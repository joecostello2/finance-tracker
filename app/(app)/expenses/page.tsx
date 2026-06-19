import { requireUser } from "@/lib/session";
import { getSpendingBreakdown, getExpenses, getCategories } from "@/lib/queries";
import { PERIOD_OPTIONS } from "@/lib/period";
import ExpensesManager from "./ExpensesManager";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const { period } = await searchParams;
  const periodKey = PERIOD_OPTIONS.some((p) => p.value === period) ? period! : "this-month";

  const [breakdown, expenses, categories] = await Promise.all([
    getSpendingBreakdown(user.id, periodKey),
    getExpenses(user.id, periodKey),
    getCategories(user.id),
  ]);

  return (
    <ExpensesManager
      breakdown={breakdown}
      expenses={expenses}
      categories={categories}
      periodKey={periodKey}
    />
  );
}
