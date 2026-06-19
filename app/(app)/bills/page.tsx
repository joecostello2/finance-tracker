import { requireUser } from "@/lib/session";
import { getBills } from "@/lib/queries";
import BillsManager from "./BillsManager";

export default async function BillsPage() {
  const user = await requireUser();
  const bills = await getBills(user.id);
  return <BillsManager bills={bills} />;
}
