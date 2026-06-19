"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ApplyState = { ok?: boolean; error?: string; message?: string };

const applySchema = z.object({
  goalContributions: z.array(z.object({ goalId: z.string(), amount: z.number().positive() })),
  logPaycheck: z
    .object({
      amount: z.number().positive(),
      date: z.string().min(1),
      frequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "ONE_TIME"]),
      source: z.string().optional(),
    })
    .optional(),
});

/**
 * Apply a suggested plan: fund the savings-goal contributions and, optionally,
 * record the paycheck. All scoped to the current user.
 */
export async function applyPlan(input: z.infer<typeof applySchema>): Promise<ApplyState> {
  const user = await requireUser();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid plan payload." };
  const { goalContributions, logPaycheck } = parsed.data;

  // Only touch goals that belong to this user.
  const goalIds = goalContributions.map((g) => g.goalId);
  const owned = await prisma.savingsGoal.findMany({
    where: { id: { in: goalIds }, userId: user.id },
    select: { id: true, currentAmount: true, targetAmount: true },
  });
  const byId = new Map(owned.map((g) => [g.id, g]));

  await prisma.$transaction(async (tx) => {
    for (const c of goalContributions) {
      const g = byId.get(c.goalId);
      if (!g) continue;
      const next = Math.min(
        Number(g.targetAmount.toString()),
        Number(g.currentAmount.toString()) + c.amount,
      );
      await tx.savingsGoal.update({ where: { id: c.goalId }, data: { currentAmount: next } });
    }
    if (logPaycheck) {
      await tx.paycheck.create({
        data: {
          userId: user.id,
          amount: logPaycheck.amount,
          date: new Date(logPaycheck.date),
          frequency: logPaycheck.frequency,
          source: logPaycheck.source || null,
        },
      });
    }
  });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/income");
  revalidatePath("/plan");

  const funded = goalContributions.length;
  return {
    ok: true,
    message: `Applied — funded ${funded} goal${funded === 1 ? "" : "s"}${logPaycheck ? " and logged the paycheck" : ""}.`,
  };
}
