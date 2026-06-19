import { requireUser } from "@/lib/session";
import { getGoals } from "@/lib/queries";
import GoalsManager from "./GoalsManager";

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await getGoals(user.id);
  return <GoalsManager goals={goals} />;
}
