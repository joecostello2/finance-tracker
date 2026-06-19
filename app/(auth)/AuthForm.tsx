"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { AuthState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

type Props = {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export default function AuthForm({ mode, action }: Props) {
  const [state, formAction] = useActionState(action, {});
  const isRegister = mode === "register";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[--color-brand] text-lg font-bold text-white">
          $
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isRegister
            ? "Start tracking your finances in one place."
            : "Sign in to your finance tracker."}
        </p>
      </div>

      <form action={formAction} className="card space-y-4 p-6">
        {isRegister && (
          <div>
            <label className="label" htmlFor="name">
              Name <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="name" name="name" type="text" className="input" placeholder="Jane Doe" autoComplete="name" />
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="email" />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            className="input"
            placeholder={isRegister ? "At least 8 characters" : "••••••••"}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <SubmitButton label={isRegister ? "Create account" : "Sign in"} />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[--color-brand] hover:underline">Sign in</Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-[--color-brand] hover:underline">Create one</Link>
          </>
        )}
      </p>
    </div>
  );
}
