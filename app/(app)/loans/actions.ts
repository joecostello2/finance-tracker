"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type FormState = { ok?: boolean; error?: string };

const LOAN_TYPES = ["MORTGAGE", "AUTO", "STUDENT", "PERSONAL", "CREDIT_LINE", "OTHER"] as const;

const optionalNumber = z
  .union([z.literal(""), z.coerce.number().finite()])
  .transform((v) => (v === "" ? null : v));

const loanSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  lender: z.string().trim().max(120).optional(),
  type: z.enum(LOAN_TYPES),
  originalAmount: z.coerce.number().finite("Enter a valid original amount.").nonnegative(),
  currentBalance: z.coerce.number().finite("Enter a valid current balance.").nonnegative(),
  interestRate: optionalNumber,
  minimumPayment: optionalNumber,
  termMonths: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .transform((v) => (v === "" ? null : v)),
  startDate: z.string().trim().optional(),
  currency: z.string().trim().length(3).default("USD"),
});

function parse(formData: FormData) {
  return loanSchema.safeParse({
    name: formData.get("name"),
    lender: (formData.get("lender") as string) || undefined,
    type: formData.get("type"),
    originalAmount: formData.get("originalAmount"),
    currentBalance: formData.get("currentBalance"),
    interestRate: (formData.get("interestRate") as string) ?? "",
    minimumPayment: (formData.get("minimumPayment") as string) ?? "",
    termMonths: (formData.get("termMonths") as string) ?? "",
    startDate: (formData.get("startDate") as string) || undefined,
    currency: ((formData.get("currency") as string) || "USD").toUpperCase(),
  });
}

function revalidate() {
  revalidatePath("/loans");
  revalidatePath("/dashboard");
}

function dataFrom(d: z.infer<typeof loanSchema>) {
  return {
    name: d.name,
    lender: d.lender || null,
    type: d.type,
    originalAmount: d.originalAmount,
    currentBalance: d.currentBalance,
    interestRate: d.interestRate,
    minimumPayment: d.minimumPayment,
    termMonths: d.termMonths,
    startDate: d.startDate ? new Date(d.startDate) : null,
    currency: d.currency,
  };
}

export async function createLoan(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  await prisma.loan.create({
    data: {
      userId: user.id,
      ...dataFrom(d),
      balanceSnapshots: { create: { balance: d.currentBalance } },
    },
  });

  revalidate();
  return { ok: true };
}

export async function updateLoan(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const result = await prisma.loan.updateMany({
    where: { id, userId: user.id },
    data: dataFrom(d),
  });
  if (result.count === 0) return { error: "Loan not found." };

  await prisma.balanceSnapshot.create({ data: { loanId: id, balance: d.currentBalance } });

  revalidate();
  return { ok: true };
}

export async function deleteLoan(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.loan.deleteMany({ where: { id, userId: user.id } });
  revalidate();
}
