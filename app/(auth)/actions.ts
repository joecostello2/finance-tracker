"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthState = { error?: string };

const registerSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // Optional invite gate for public deployments: if SIGNUP_CODE is set, the
  // registrant must supply the matching code. Unset (e.g. local dev) = open signup.
  const requiredCode = process.env.SIGNUP_CODE;
  if (requiredCode) {
    const provided = ((formData.get("code") as string) || "").trim();
    if (provided !== requiredCode) {
      return { error: "Invalid or missing invite code." };
    }
  }

  const parsed = registerSchema.safeParse({
    name: (formData.get("name") as string) || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { email, name: parsed.data.name || null, passwordHash },
  });

  // signIn throws a redirect (NEXT_REDIRECT) on success, which must propagate.
  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
  return {};
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Re-throw redirect and other framework errors.
    throw error;
  }
}
