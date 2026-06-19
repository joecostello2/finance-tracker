import { requireUser } from "@/lib/session";
import { getPaychecks } from "@/lib/queries";
import IncomeManager from "./IncomeManager";

export default async function IncomePage() {
  const user = await requireUser();
  const paychecks = await getPaychecks(user.id);
  return <IncomeManager paychecks={paychecks} />;
}
