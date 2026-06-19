# Deploying Finance Tracker (Vercel + Neon)

This guide puts the app online so your family can sign in from any device. It uses
**Vercel** (hosts the app) and **Neon** (hosts the Postgres database) — both free
for family-scale use — with code on **GitHub**.

You'll do the account/click steps; the app is already configured for this setup
(`postinstall` runs `prisma generate`, migrations can use a direct DB URL, and
sign-ups can be gated with an invite code).

---

## 1. Push the code to GitHub

1. Create a new **empty** repo at <https://github.com/new> (e.g. `finance-tracker`).
   Don't add a README/license — the project already has them.
2. In the project folder, connect and push (replace `YOUR-USERNAME`):

   ```bash
   cd ~/finance-tracker
   git remote add origin https://github.com/YOUR-USERNAME/finance-tracker.git
   git branch -M main
   git push -u origin main
   ```

   If prompted for a password, use a **GitHub Personal Access Token** (Settings →
   Developer settings → Tokens), not your account password.

---

## 2. Create the database (Neon)

1. Sign up at <https://neon.tech> (free) and create a project (pick a region near you).
2. In the project's **Connection Details**, grab **two** connection strings:
   - **Pooled** connection (has `-pooler` in the host) → this is your `DATABASE_URL`.
   - **Direct** connection (no `-pooler`) → this is your `DIRECT_DATABASE_URL`.

   Both should include `?sslmode=require`.

---

## 3. Apply the schema to Neon (from your laptop, once)

Run the migrations against the **direct** Neon URL so the tables exist:

```bash
cd ~/finance-tracker
DIRECT_DATABASE_URL="<your Neon DIRECT url>" npx prisma migrate deploy
```

> Do **not** seed the demo account in production (it has a known password).
> You'll create your real account through the app's sign-up page in step 6.

---

## 4. Import the project into Vercel

1. Sign up at <https://vercel.com> with your GitHub account.
2. **Add New → Project**, import your `finance-tracker` repo. Vercel auto-detects
   Next.js — leave the build settings at their defaults.
3. Before clicking **Deploy**, open **Environment Variables** and add:

   | Name                  | Value                                                        |
   | --------------------- | ------------------------------------------------------------ |
   | `DATABASE_URL`        | your Neon **pooled** connection string                       |
   | `DIRECT_DATABASE_URL` | your Neon **direct** connection string                       |
   | `AUTH_SECRET`         | a fresh secret: `openssl rand -base64 33`                    |
   | `AUTH_TRUST_HOST`     | `true`                                                       |
   | `SIGNUP_CODE`         | a shared family code (e.g. `our-family-2026`) — gates sign-ups |

4. Click **Deploy**. When it finishes you'll get a URL like
   `https://finance-tracker-xxxx.vercel.app`.

---

## 5. (Optional) Custom domain

Vercel → Project → **Settings → Domains** → add your domain and follow the DNS
instructions. The free `*.vercel.app` URL works fine without this.

---

## 6. Create your accounts

1. Visit your Vercel URL and go to **Create one** (the register page).
2. Enter the **invite code** (`SIGNUP_CODE`) plus your email/password.
3. Share the URL + invite code with family members — each person registers their
   own account and sees only their own data.

---

## Updating the app later

Because Vercel is connected to GitHub, every push to `main` auto-deploys:

```bash
git add -A && git commit -m "your change"
git push
```

If a change includes a **schema migration**, apply it to Neon first:

```bash
DIRECT_DATABASE_URL="<your Neon DIRECT url>" npx prisma migrate deploy
```

---

## Security checklist (going public)

- [x] `AUTH_SECRET` is a fresh value, set only in Vercel (never committed).
- [x] `SIGNUP_CODE` set so only people with the code can register.
- [x] Demo seed **not** run in production.
- [x] HTTPS + secure cookies (automatic on Vercel).
- [ ] Consider Neon's automated backups (enabled by default on paid; export
      periodically on free).
