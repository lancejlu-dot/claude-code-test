# Implementation and Testing Plan

## Stack
Next.js 16 (App Router, Server Actions, TypeScript) · Tailwind CSS 4 · Supabase (Postgres 15+, Auth, Storage, RLS) · Stripe Checkout · Resend · Vercel (with Vercel Cron).

## Architecture
```
Browser ──▶ Next.js server components (reads via supabase-js under the user's JWT → RLS applies)
        └─▶ Server Actions ──▶ supabase.rpc('business_function')  ← all state changes & rules
Stripe ──▶ /api/stripe/webhook (signature verified) ──▶ service-role RPC record_online_payment
Vercel Cron ──▶ /api/cron/* (CRON_SECRET) ──▶ run_scheduled_jobs() + email dispatch via Resend
```
The service-role key is used **only** in the webhook, cron routes and account-deletion clean-up; never shipped to the browser.

## Build order (as executed)
1. Docs (this folder).
2. Migrations: schema → helpers & business functions → RLS → storage → seed.
3. SQL tests against a real Postgres with an `auth` schema stub (`supabase/tests`).
4. App shell, design system, demo-mode data source.
5. Public pages → auth → member area → admin portal → integrations.
6. Typecheck, lint, unit tests, production build, screenshot review.

## Testing strategy
| Layer | Tooling | What is covered |
| --- | --- | --- |
| Database rules | `supabase/tests/*.sql` run by `npm run test:db` on Postgres 15/16 | capacity cannot be exceeded; inactive/restricted members cannot apply; confirmation blocked without waiver/payment; re-sign requirement; no-show → restriction trigger; appeals restore access; event cancellation never penalises; waitlist auto-promotion and offer expiry; RLS: members can't read others' private data, organizers only see their events' contacts, last-initial-only public profile |
| Pure logic | Vitest (`npm test`) | filter parsing, status labels, ICS generation, money formatting, field-visibility rules |
| Build | `npm run typecheck`, `npm run lint`, `npm run build` | type safety, route compilation |
| UI | Playwright screenshots (demo mode) | homepage, discovery, event detail at mobile & desktop widths |
| Manual pre-launch (staging Supabase + Stripe test mode) | checklist below | end-to-end flows |

## Pre-launch checklist
- [ ] Create Supabase project; run migrations; **do not** run demo seed in production.
- [ ] Configure Auth: email confirmations ON, site URL, redirect URLs, SMTP (Resend) for auth emails.
- [ ] Set Vercel env vars (see `.env.example`); set `CRON_SECRET`.
- [ ] Stripe: live keys, webhook endpoint `/api/stripe/webhook` with `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`.
- [ ] Owner account: sign up, then `select public.bootstrap_owner('owner@email')` once in the SQL editor.
- [ ] Legal review of every waiver template and policy page; mark reviewed in admin.
- [ ] Enable Supabase Point-in-Time Recovery / daily backups (Pro plan) and test a restore.
- [ ] Enable MFA for staff accounts.
- [ ] Replace illustrated defaults with real photography (with photo consent).
- [ ] Run through journeys J1–J9 and A1–A7 in Stripe test mode.
