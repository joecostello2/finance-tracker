import { requireUser } from "@/lib/session";
import { getAccounts } from "@/lib/queries";
import AccountsManager from "./AccountsManager";

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await getAccounts(user.id);
  return <AccountsManager accounts={accounts} />;
}
