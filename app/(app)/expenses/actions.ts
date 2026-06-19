"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { suggestCategory, categoryColor } from "@/lib/categorize";

export type FormState = { ok?: boolean; error?: string };

const schema = z.object({
  description: z.string().trim().min(1, "Description is required.").max(200),
  amount: z.coerce.number().finite("Enter a valid amount.").positive("Amount must be positive."),
  date: z.string().trim().min(1, "Date is required."),
  // Empty string = let the engine auto-categorize from the description.
  category: z.string().trim().max(60).optional(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    category: (formData.get("category") as string) || undefined,
  });
}

/** Find the user's category by name (case-insensitive), creating it if needed. */
async function resolveCategoryId(userId: string, name: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { userId, name, color: categoryColor(name) },
  });
  return created.id;
}

function revalidate() {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function createExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Auto-categorize from the description when no category was chosen.
  const categoryName = d.category || suggestCategory(d.description);
  const categoryId = await resolveCategoryId(user.id, categoryName);

  await prisma.transaction.create({
    data: {
      userId: user.id,
      description: d.description,
      amount: d.amount,
      type: "EXPENSE",
      date: new Date(d.date),
      categoryId,
    },
  });

  revalidate();
  return { ok: true };
}

export async function updateExpense(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const categoryName = d.category || suggestCategory(d.description);
  const categoryId = await resolveCategoryId(user.id, categoryName);

  const result = await prisma.transaction.updateMany({
    where: { id, userId: user.id, type: "EXPENSE" },
    data: { description: d.description, amount: d.amount, date: new Date(d.date), categoryId },
  });
  if (result.count === 0) return { error: "Expense not found." };

  revalidate();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.transaction.deleteMany({ where: { id, userId: user.id, type: "EXPENSE" } });
  revalidate();
}
