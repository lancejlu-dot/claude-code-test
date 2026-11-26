# Ridgeline Collective — Outdoor Community Platform

A curated, admin-moderated outdoor community platform for the Lower Mainland of British Columbia (expandable to any region).
Members apply to join, apply to individual activities, and are **selected** by organizers. Waivers, payments, attendance,
waitlists, no-show accountability, private event pages and a full admin portal are included.

> **Working name.** "Ridgeline Collective", the tagline, colours, homepage copy and imagery are all editable in
> **Admin → Settings / Content**. All people, emails and activities in the demo data are fictional.

| | |
| --- | --- |
| Stack | Next.js 16 (App Router, Server Actions, TypeScript), Tailwind CSS 4, Supabase (Postgres, Auth, Storage, RLS), Stripe Checkout, Resend, Vercel |
| Planning docs | [`docs/`](docs) — PRD, data model & roles, user journeys, pages & components, phasing, implementation & test plan |
| Business rules | [`supabase/migrations`](supabase/migrations) — enforced in the database, not just the UI |

---

## What's real and what isn't

| Area | Status |
| --- | --- |
| Accounts, approval, events, applications, capacity, waitlist, attendance, appeals, admin portal | **Functional** once connected to Supabase |
| Online payments | **Functional with your Stripe keys.** Without them, online payment options are hidden and the admin portal says so. Seed payments are labelled *DEMO* and are not real |
| Email | **Functional with a Resend key.** Without it, emails stay in the outbox marked *queued* and are never reported as sent. In-app notifications always work |
| Waivers & policies | Working e-signature system, but **all waiver and policy text is a draft template** and is labelled as needing legal review until the owner marks each one reviewed |
| Photos | Default imagery is generated landscape artwork (`public/images`). Upload real, consented photography through the admin portal |
| Demo mode | With no Supabase keys, public pages show fictional sample data behind a *"Demo data"* banner; all sign-in and write actions are disabled |

---

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # leave Supabase blank to run in demo mode
npm run dev                  # http://localhost:3000
```

### Connect a real database

1. Create a project at [supabase.com](https://supabase.com) (Canada Central region recommended for data residency).
2. Apply the migrations — either `supabase link && supabase db push`, or paste each file in `supabase/migrations/` into the SQL editor in order.
3. (Staging only) load fictional demo data: run `supabase/seed.sql` in the SQL editor. Every demo account's password is `ridgeline-demo-2026`
   (e.g. `maya.owner@example.com` = owner, `daniel.admin@example.com` = admin, `priya.organizer@example.com` = organizer, `jordan@example.com` = member).
   **Never run the seed in production.**
4. Fill in `.env.local` with your project URL, publishable key and secret key.
5. Supabase → Authentication:
   - Email confirmations **on**; Site URL = your domain; add `https://YOUR-DOMAIN/auth/confirm` to Redirect URLs.
   - Email templates: change the confirm/reset links to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (and `type=recovery` for password reset).
   - Configure custom SMTP (Resend works) so auth emails come from your domain.
6. Sign up through the website, then make yourself the owner (once) in the SQL editor:
   ```sql
   select public.bootstrap_owner('you@example.com');
   ```

### Payments (Stripe)

1. Add `STRIPE_SECRET_KEY`.
2. Create a webhook endpoint at `https://YOUR-DOMAIN/api/stripe/webhook` for `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.expired` and `charge.refunded`; set `STRIPE_WEBHOOK_SECRET`.
3. Use test mode first. Card details are handled entirely by Stripe Checkout; this platform stores only Stripe IDs.

### Email (Resend) and scheduled jobs

Set `RESEND_API_KEY`, `EMAIL_FROM` (a verified domain) and `CRON_SECRET`. `vercel.json` runs `/api/cron/jobs` every 15 minutes
(waitlist offer expiry, confirmation deadlines, reminders, restriction expiry, email delivery) and once daily with `?purge=1` (data retention).

### Deploy (Vercel)

Import the repo, add the environment variables from `.env.example`, deploy. Then:
- Enable **daily backups / Point-in-Time Recovery** in Supabase (Pro plan) and test a restore.
- Enable **MFA** for every staff account.

---

## Running the owner's day-to-day (no code required)

| Task | Where |
| --- | --- |
| Approve new members | Admin → Members (filter *Pending*) |
| Create / duplicate / publish / postpone / cancel events | Admin → Events |
| Hide fields that don't apply (e.g. elevation for kayaking) | Event editor → *Extras* (category defaults in Settings → Categories) |
| Restrict exact meeting point to selected participants | Event editor → *Logistics* 🔒 |
| Review applicants (batch approve, waitlist, invite, reserved spaces) | Event → Applicants |
| Event day: check-in, payments, waivers, headcounts, emergency contacts, incidents | Event → Roster (works on a phone) |
| No-shows & appeals | Roster → *Confirm no-show*; Admin → Appeals |
| Edit waivers (new version / require re-signing) | Admin → Waivers |
| Refunds, cash, transaction history | Admin → Payments |
| Announcements to members / participants / groups | Admin → Announcements |
| FAQ, policies, homepage copy, highlights | Admin → Content |
| Regions, categories, approval mode, retention, staff roles | Admin → Settings (owner) and each member's page |

---

## Testing

```bash
npm run typecheck        # TypeScript
npm run lint             # ESLint
npm test                 # unit tests (filters, time zones, calendar files, demo data)
npm run test:db          # SQL rule tests on a throwaway Postgres DB (needs psql + a local Postgres 15+)
npm run check:queries    # verifies every app query/RPC against the migrated schema (DATABASE_URL)
npm run build
```

`npm run test:db` applies every migration and the seed to a temporary database (with a small stand-in for Supabase's `auth`
schema) and runs 76 assertions covering capacity limits, approval gates, waiver and payment gating, re-signing, no-show
restriction, appeals, cancellations, waitlist promotion and offer expiry, invitations using reserved spaces, and RLS isolation
of private data. Set `DATABASE_ADMIN_URL` if your Postgres isn't on the local socket.

Regenerate generated files: `npm run gen:seed` (seed from `src/lib/demo/data.ts`), `npm run gen:content`
(demo-mode copy of the base content), `npx tsx scripts/generate-scenes.ts` (illustrations).

---

## Security model (summary)

- Row Level Security on every table; grants start from nothing. Sensitive contact data lives in `member_private`
  (self + admins only). Organizers reach emergency contacts only through an audited function, only for confirmed
  participants of their own events.
- Every state change (apply, approve, confirm, pay, cancel, attendance, appeals, status changes) is a `SECURITY DEFINER`
  database function that re-checks the caller's role. Members cannot write applications, payments or statuses directly.
- Capacity is enforced with row locks, so concurrent approvals can't overbook.
- The secret key is used only by the Stripe webhook, cron and account deletion.
- Audit log of significant admin actions; CSV exports run under the caller's own permissions.
- See `docs/02-data-model-and-roles.md` for the permission matrix.

## Known limitations and next steps

See `docs/05-phasing.md`. Notably: badges are awarded manually; no weather API; no SMS; maps and geocoding are not included;
staff MFA should be enabled in Supabase before launch; the end-to-end flows have been verified at the database and build level
but should be run through once on a staging Supabase project with Stripe in test mode before going live.
