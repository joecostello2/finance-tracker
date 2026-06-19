"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type FormState = { ok?: boolean; error?: string };

const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  amount: z.coerce.number().finite("Enter a valid amount.").positive("Amount must be positive."),
  frequency: z.enum(FREQUENCIES),
  nextDueDate: z.string().trim().min(1, "Next due date is required."),
  category: z.string().trim().max(60).optional(),
  autopay: z.coerce.boolean().optional(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
    nextDueDate: formData.get("nextDueDate"),
    category: (formData.get("category") as string) || undefined,
    autopay: formData.get("autopay") === "on",
  });
}

function revalidate() {
  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
}

function dataFrom(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    amount: d.amount,
    frequency: d.frequency,
    nextDueDate: new Date(d.nextDueDate),
    category: d.category || null,
    autopay: Boolean(d.autopay),
  };
}

export async function createBill(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await prisma.bill.create({ data: { userId: user.id, ...dataFrom(parsed.data) } });
  revalidate();
  return { ok: true };
}

export async function updateBill(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const result = await prisma.bill.updateMany({ where: { id, userId: user.id }, data: dataFrom(parsed.data) });
  if (result.count === 0) return { error: "Bill not found." };
  revalidate();
  return { ok: true };
}

export async function deleteBill(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.bill.deleteMany({ where: { id, userId: user.id } });
  revalidate();
}
