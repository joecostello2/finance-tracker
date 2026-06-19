import AuthForm from "../AuthForm";
import { registerAction } from "../actions";

export default function RegisterPage() {
  // When SIGNUP_CODE is configured (public deployments), require an invite code.
  const requireCode = Boolean(process.env.SIGNUP_CODE);
  return <AuthForm mode="register" action={registerAction} requireCode={requireCode} />;
}
