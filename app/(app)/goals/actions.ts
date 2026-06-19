"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type FormState = { ok?: boolean; error?: string };

const optionalNumber = z
  .union([z.literal(""), z.coerce.number().finite().nonnegative()])
  .transform((v) => (v === "" ? null : v));

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  targetAmount: z.coerce.number().finite("Enter a valid target.").positive("Target must be positive."),
  currentAmount: z.coerce.number().finite().nonnegative().default(0),
  monthlyTarget: optionalNumber,
  priority: z.coerce.number().int().min(0).default(0),
  isEmergencyFund: z.coerce.boolean().optional(),
  deadline: z.string().trim().optional(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount") || 0,
    monthlyTarget: (formData.get("monthlyTarget") as string) ?? "",
    priority: formData.get("priority") || 0,
    isEmergencyFund: formData.get("isEmergencyFund") === "on",
    deadline: (formData.get("deadline") as string) || undefined,
  });
}

function revalidate() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
}

function dataFrom(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    targetAmount: d.targetAmount,
    currentAmount: d.currentAmount,
    monthlyTarget: d.monthlyTarget,
    priority: d.priority,
    isEmergencyFund: Boolean(d.isEmergencyFund),
    deadline: d.deadline ? new Date(d.deadline) : null,
  };
}

export async function createGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await prisma.savingsGoal.create({ data: { userId: user.id, ...dataFrom(parsed.data) } });
  revalidate();
  return { ok: true };
}

export async function updateGoal(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const result = await prisma.savingsGoal.updateMany({ where: { id, userId: user.id }, data: dataFrom(parsed.data) });
  if (result.count === 0) return { error: "Goal not found." };
  revalidate();
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.savingsGoal.deleteMany({ where: { id, userId: user.id } });
  revalidate();
}

/** Add (or subtract, if negative) an amount to a goal's current balance. */
export async function contributeToGoal(id: string, amount: number): Promise<void> {
  const user = await requireUser();
  if (!Number.isFinite(amount) || amount === 0) return;
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id } });
  if (!goal) return;
  const next = Math.max(0, Number(goal.currentAmount.toString()) + amount);
  await prisma.savingsGoal.update({ where: { id }, data: { currentAmount: next } });
  revalidate();
}
