"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type FormState = { ok?: boolean; error?: string };

const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "ONE_TIME"] as const;

const schema = z.object({
  source: z.string().trim().max(120).optional(),
  amount: z.coerce.number().finite("Enter a valid amount.").positive("Amount must be positive."),
  date: z.string().trim().min(1, "Date is required."),
  frequency: z.enum(FREQUENCIES),
  notes: z.string().trim().max(500).optional(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    source: (formData.get("source") as string) || undefined,
    amount: formData.get("amount"),
    date: formData.get("date"),
    frequency: formData.get("frequency"),
    notes: (formData.get("notes") as string) || undefined,
  });
}

function revalidate() {
  revalidatePath("/income");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
}

export async function createPaycheck(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  await prisma.paycheck.create({
    data: {
      userId: user.id,
      source: d.source || null,
      amount: d.amount,
      date: new Date(d.date),
      frequency: d.frequency,
      notes: d.notes || null,
    },
  });

  revalidate();
  return { ok: true };
}

export async function updatePaycheck(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const result = await prisma.paycheck.updateMany({
    where: { id, userId: user.id },
    data: {
      source: d.source || null,
      amount: d.amount,
      date: new Date(d.date),
      frequency: d.frequency,
      notes: d.notes || null,
    },
  });
  if (result.count === 0) return { error: "Paycheck not found." };

  revalidate();
  return { ok: true };
}

export async function deletePaycheck(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.paycheck.deleteMany({ where: { id, userId: user.id } });
  revalidate();
}
