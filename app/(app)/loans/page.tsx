import { requireUser } from "@/lib/session";
import { getLoans } from "@/lib/queries";
import LoansManager from "./LoansManager";

export default async function LoansPage() {
  const user = await requireUser();
  const loans = await getLoans(user.id);
  return <LoansManager loans={loans} />;
}
