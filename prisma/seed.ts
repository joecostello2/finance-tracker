import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

// Build N monthly snapshot dates ending today (oldest first).
function monthlyDates(months: number): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    out.push(d);
  }
  return out;
}

async function main() {
  // Idempotent: wipe and recreate the demo user (cascades to all their data).
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Demo User", passwordHash },
  });

  const dates = monthlyDates(6);

  // Each account: current balance + a series factor applied to older months.
  const accounts = [
    { name: "Everyday Checking", institution: "Chase", type: "CHECKING", balance: 4250 },
    { name: "High-Yield Savings", institution: "Ally", type: "SAVINGS", balance: 18500 },
    { name: "Brokerage", institution: "Vanguard", type: "INVESTMENT", balance: 32400 },
    { name: "401(k)", institution: "Fidelity", type: "RETIREMENT", balance: 64200 },
    { name: "Travel Card", institution: "Amex", type: "CREDIT_CARD", balance: 1480 },
  ] as const;

  for (const a of accounts) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        name: a.name,
        institution: a.institution,
        type: a.type,
        balance: a.balance,
        currency: "USD",
      },
    });
    // Trend assets upward over time; keep the credit card roughly flat.
    const snaps = dates.map((date, idx) => {
      const t = idx / (dates.length - 1); // 0..1
      const growth = a.type === "CREDIT_CARD" ? 1 : 0.9 + 0.1 * t;
      const value = Math.round(a.balance * growth * 100) / 100;
      return { accountId: created.id, date, balance: value };
    });
    await prisma.balanceSnapshot.createMany({ data: snaps });
  }

  const loans = [
    { name: "Home Mortgage", lender: "Wells Fargo", type: "MORTGAGE", originalAmount: 320000, currentBalance: 297800, interestRate: 6.25, minimumPayment: 1970, termMonths: 360, monthlyPaydown: 350 },
    { name: "Auto Loan", lender: "Capital One", type: "AUTO", originalAmount: 28000, currentBalance: 14200, interestRate: 4.9, minimumPayment: 480, termMonths: 60, monthlyPaydown: 420 },
    { name: "Student Loan", lender: "SoFi", type: "STUDENT", originalAmount: 45000, currentBalance: 20900, interestRate: 5.5, minimumPayment: 350, termMonths: 120, monthlyPaydown: 300 },
  ] as const;

  for (const l of loans) {
    const created = await prisma.loan.create({
      data: {
        userId: user.id,
        name: l.name,
        lender: l.lender,
        type: l.type,
        originalAmount: l.originalAmount,
        currentBalance: l.currentBalance,
        interestRate: l.interestRate,
        minimumPayment: l.minimumPayment,
        termMonths: l.termMonths,
        startDate: new Date(new Date().getFullYear() - 3, 0, 1),
        currency: "USD",
      },
    });
    // Older months had a higher balance (debt has been paid down since).
    const snaps = dates.map((date, idx) => {
      const monthsAgo = dates.length - 1 - idx;
      const value = Math.round((l.currentBalance + monthsAgo * l.monthlyPaydown) * 100) / 100;
      return { loanId: created.id, date, balance: value };
    });
    await prisma.balanceSnapshot.createMany({ data: snaps });
  }

  // --- Income: recent biweekly paychecks ---
  const now = new Date();
  const paycheckDates = [0, 14, 28].map(
    (daysAgo) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo),
  );
  await prisma.paycheck.createMany({
    data: paycheckDates.map((date) => ({
      userId: user.id,
      source: "Acme Corp",
      amount: 4200,
      date,
      frequency: "BIWEEKLY" as const,
    })),
  });

  // --- Bills: recurring monthly obligations ---
  const billDay = (day: number) => new Date(now.getFullYear(), now.getMonth(), day);
  await prisma.bill.createMany({
    data: [
      { userId: user.id, name: "Rent", amount: 1850, frequency: "MONTHLY" as const, nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1), category: "Housing" },
      { userId: user.id, name: "Electric", amount: 120, frequency: "MONTHLY" as const, nextDueDate: billDay(10), category: "Utilities" },
      { userId: user.id, name: "Internet", amount: 70, frequency: "MONTHLY" as const, nextDueDate: billDay(15), category: "Utilities", autopay: true },
      { userId: user.id, name: "Cell phone", amount: 85, frequency: "MONTHLY" as const, nextDueDate: billDay(20), category: "Utilities", autopay: true },
      { userId: user.id, name: "Car insurance", amount: 140, frequency: "MONTHLY" as const, nextDueDate: billDay(5), category: "Insurance" },
      { userId: user.id, name: "Streaming", amount: 45, frequency: "MONTHLY" as const, nextDueDate: billDay(25), category: "Subscriptions", autopay: true },
    ],
  });

  // --- Savings goals (priority order; emergency fund first) ---
  await prisma.savingsGoal.createMany({
    data: [
      { userId: user.id, name: "Emergency fund", targetAmount: 15000, currentAmount: 6000, monthlyTarget: 500, priority: 0, isEmergencyFund: true },
      { userId: user.id, name: "Vacation", targetAmount: 4000, currentAmount: 800, monthlyTarget: 200, priority: 1 },
      { userId: user.id, name: "New car fund", targetAmount: 20000, currentAmount: 2500, monthlyTarget: 300, priority: 2 },
    ],
  });

  console.log(`\nSeeded demo data.`);
  console.log(`  Login:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
