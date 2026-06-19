# Finance Tracker

A centralized, multi-user web app for tracking your financial accounts, loans, and
net worth. Each person signs into their own account and sees only their own data.
Built for manual entry today, with a data model that's ready for automatic bank
syncing (Plaid) later — no rewrite required.

## Features

- **Multi-user auth** — email/password sign-up & login (passwords hashed with bcrypt). All data is scoped per user.
- **Accounts** — checking, savings, investment, retirement, cash, and credit cards.
- **Loans & debts** — mortgage, auto, student, personal, with APR, minimum payment, term, and a payoff-progress bar.
- **Income** — log every paycheck with amount, source, date, and frequency; see estimated monthly income.
- **Expenses** — log spending, **auto-categorized** from the merchant/description, with a category breakdown (donut + ranked % share), period comparison (this month / last month / 30 / 90 days / year), and plain-language **insights** about where your money goes and what to cut.
- **Bills** — recurring obligations (rent, utilities, subscriptions) with amount, frequency, next due date, and autopay.
- **Savings goals** — targets with progress, priority order, an emergency-fund flag, and a "contribute" action.
- **Paycheck allocation planner** (`/plan`) — the suggestion engine. Enter a paycheck and it produces a transparent **priority waterfall**: cover bills due before your next paycheck → fund the emergency fund → fund savings goals (priority order) → extra debt paydown (**avalanche**, highest-APR loan first) → discretionary. Every line explains *why*, and you can apply the plan to fund your goals in one click.
- **Dashboard** — net worth (assets − liabilities), monthly cash-flow card (income vs. bills vs. leftover), net-worth-over-time chart, and asset allocation breakdown.
- **Balance history** — every edit records a snapshot, so trends build up over time.
- **Sync-ready schema** — `source`, `externalId`, and a `PlaidItem` model are already in place for a future bank-sync integration.

### How the allocation engine works

The engine lives in [`lib/allocation.ts`](lib/allocation.ts) as a pure, testable function. For a given paycheck it computes the pay-period window (from the pay frequency), then allocates in strict priority:

1. **Bills** that actually come due before the next paycheck (recurring occurrences are projected from each bill's next due date).
2. **Loan minimum payments** — this period's prorated share of your monthly minimums.
3. **Emergency fund**, then **other savings goals** in priority order (toward each goal's monthly target, or a deadline-derived amount).
4. **Extra debt paydown** — targets the highest-APR loan (avalanche) with a share of what's left.
5. **Discretionary** — the remainder.

If required obligations exceed the paycheck, it reports the **shortfall** instead of over-allocating. The policy knobs (e.g. the extra-debt share) are constants at the top of the file.

## Tech stack

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Charts   | Recharts                                 |
| Backend  | Next.js Server Actions                   |
| Auth     | Auth.js (NextAuth v5), JWT sessions      |
| Database | PostgreSQL 17 (via Docker)               |
| ORM      | Prisma 7 (with the `pg` driver adapter)  |

## Getting started

**Prerequisites:** Node.js 20+ and Docker.

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres (Docker) — runs on host port 5433
npm run db:up

# 3. Apply the schema and generate the Prisma client
npm run db:migrate          # first run will create the database tables
npx prisma generate

# 4. (Optional) Load demo data
npm run db:seed

# 5. Start the app
npm run dev
```

Open http://localhost:3000.

### Demo login (after `npm run db:seed`)

```
Email:    demo@example.com
Password: password123
```

Or click **Create one** on the login screen to register a fresh account.

## Environment variables (`.env`)

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `DATABASE_URL`    | Postgres connection string (defaults to the Docker DB on 5433) |
| `AUTH_SECRET`     | Secret used to sign sessions. Regenerate with `openssl rand -base64 33` |
| `AUTH_TRUST_HOST` | Set to `true` for local development                            |

> The committed `.env` contains a development secret. **Generate a new `AUTH_SECRET` before deploying anywhere real.**

## Project structure

```
app/
  (auth)/          # login & register pages + auth server actions
  (app)/           # authenticated area (shared sidebar layout)
    dashboard/     # net worth + cash-flow summary + charts
    accounts/      # accounts list, add/edit/delete + server actions
    loans/         # loans list, add/edit/delete + server actions
    income/        # paycheck log + server actions
    expenses/      # spending log, auto-categorization, breakdown + insights
    bills/         # recurring bills + server actions
    goals/         # savings goals + contribute + server actions
    plan/          # paycheck allocation planner (runs the engine)
  api/auth/        # Auth.js route handlers
  generated/prisma # generated Prisma client (gitignored)
lib/
  prisma.ts        # PrismaClient singleton (pg adapter)
  queries.ts       # user-scoped read queries + net-worth & cash-flow math
  allocation.ts    # the paycheck allocation engine (pure function)
  categorize.ts    # keyword-based expense auto-categorization engine
  period.ts        # time-period resolver for spending analytics
  money.ts         # currency formatting & helpers
  session.ts       # requireUser() guard
auth.ts            # Auth.js config (Node runtime, credentials provider)
auth.config.ts     # edge-safe Auth.js config (used by middleware)
middleware.ts      # route protection
prisma/
  schema.prisma    # data model
  seed.ts          # demo data
```

## Security notes

- Passwords are hashed with bcrypt; only the hash is stored.
- Every read and write is scoped by `userId`, so users can't access each other's data.
- This is a personal/family project — before exposing it to the internet, regenerate `AUTH_SECRET`, use a managed Postgres with backups, and serve over HTTPS.

## Roadmap (the model already supports these)

- **Bank syncing via Plaid** — populate `Account`/`Transaction` from `source = PLAID` using the `PlaidItem` model.
- **Transactions & budgets** — the `Transaction` and `Category` tables exist; add UI to log spending and budget by category.
- **Household sharing** — group users into a household to optionally share a combined view.
- **Configurable allocation policy** — surface the engine's knobs (debt strategy avalanche/snowball, extra-debt share, emergency-fund priority) as per-user settings.
- **Plan history** — persist applied plans so you can review past allocations and track suggested vs. actual.
