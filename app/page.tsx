import { redirect } from "next/navigation";

// Middleware redirects unauthenticated users to /login, so anyone who reaches
// the root and is signed in goes straight to their dashboard.
export default function Home() {
  redirect("/dashboard");
}
