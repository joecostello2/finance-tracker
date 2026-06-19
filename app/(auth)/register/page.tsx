import AuthForm from "../AuthForm";
import { registerAction } from "../actions";

// Read SIGNUP_CODE at request time (not baked in at build) so the invite gate
// reflects the current environment without needing a rebuild.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  // When SIGNUP_CODE is configured (public deployments), require an invite code.
  const requireCode = Boolean(process.env.SIGNUP_CODE);
  return <AuthForm mode="register" action={registerAction} requireCode={requireCode} />;
}
