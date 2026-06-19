import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Returns the signed-in user, or redirects to /login. Use at the top of every
 * protected Server Component / Server Action so all data access is scoped to a
 * known userId.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}
