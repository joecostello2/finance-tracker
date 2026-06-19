"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type FormState = { ok?: boolean; error?: string };

const ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
  "INVESTMENT",
  "RETIREMENT",
  "CASH",
  "OTHER",
] as const;

const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  institution: z.string().trim().max(120).optional(),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.coerce.number().finite("Enter a valid balance."),
  currency: z.string().trim().length(3).default("USD"),
});

function parse(formData: FormData) {
  return accountSchema.safeParse({
    name: formData.get("name"),
    institution: (formData.get("institution") as string) || undefined,
    type: formData.get("type"),
    balance: formData.get("balance"),
    currency: ((formData.get("currency") as string) || "USD").toUpperCase(),
  });
}

function revalidate() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  await prisma.account.create({
    data: {
      userId: user.id,
      name: d.name,
      institution: d.institution || null,
      type: d.type,
      balance: d.balance,
      currency: d.currency,
      balanceSnapshots: { create: { balance: d.balance } },
    },
  });

  revalidate();
  return { ok: true };
}

export async function updateAccount(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Scope the update to this user so one user can't edit another's account.
  const result = await prisma.account.updateMany({
    where: { id, userId: user.id },
    data: {
      name: d.name,
      institution: d.institution || null,
      type: d.type,
      balance: d.balance,
      currency: d.currency,
    },
  });
  if (result.count === 0) return { error: "Account not found." };

  // Record a new point in the balance history.
  await prisma.balanceSnapshot.create({ data: { accountId: id, balance: d.balance } });

  revalidate();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.account.deleteMany({ where: { id, userId: user.id } });
  revalidate();
}
