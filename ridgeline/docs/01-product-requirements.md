# Ridgeline Collective — Product Requirements Document

> Working name: **Ridgeline Collective**. The name, logo, colours, hero imagery and all copy are editable by the owner in **Admin → Settings / Content** without code changes.

## 1. Purpose

A curated, admin-moderated outdoor community for the Lower Mainland of British Columbia. Members apply to join, apply to individual activities, and are selected by organizers based on fair, activity-related criteria. The platform is **not** a social network and **not** an open ticketing marketplace.

## 2. Goals and non-goals

| Goals | Non-goals (initial launch) |
| --- | --- |
| Safe, reliable groups with predictable attendance | Public follower counts, likes, attractiveness ratings |
| Admins control membership, participation, safety and standards | Unrestricted member-to-member private messaging |
| Members see only what they need about each other | Public event marketplace / open ticketing |
| Non-technical owner can run everything from the admin portal | Native mobile apps (responsive web first) |
| Expandable beyond the Lower Mainland without redesign | Multi-currency payments (CAD only at launch) |

## 3. Personas

- **Prospective member** – discovers the community, reads policies, signs up.
- **Member** – applies to activities, signs waivers, pays, attends, suggests activities.
- **Event organizer** – runs assigned events: reviews applicants, posts updates, takes attendance and headcounts, records incidents, can see emergency contacts for *their* events only.
- **Moderator** – reviews discussions and reported content; enforces guidelines.
- **Administrator** – membership, events, applications, attendance, appeals, communications.
- **Owner** – everything above plus financial settings, administrator management and platform configuration.

## 4. Functional requirements (traceable to the brief)

Each requirement is numbered by its section in the original brief. ✅ = delivered in launch phase (Phase 1–3); ◐ = partially, with the remainder in the roadmap; ⏭ = future phase.

### 4.1 Design & UX (§2) ✅
Premium outdoor aesthetic, large imagery, natural palette, generous spacing, mobile-first, accessible (WCAG 2.1 AA targets: colour contrast, focus states, labelled inputs, reduced-motion support).

### 4.2 Homepage (§3) ✅
Hero, values, upcoming & featured activities, categories, statistics (live, with optional owner overrides), highlights (only photos flagged *consent confirmed*), how it works, FAQ excerpt, CTAs. All sections editable via **Admin → Content**.

### 4.3 Event management (§4) ✅
Create, edit, duplicate, publish, postpone, cancel, delete (drafts only; published events are cancelled, not deleted, to preserve records). All §4 fields supported. Fields can be hidden per event; category defaults hide irrelevant fields (e.g. *elevation gain* for kayaking). Sensitive logistics (exact meeting point, parking, additional instructions, carpool details) live in a separate table and can be restricted to approved participants at the database level.

### 4.4 Discovery (§5) ✅
Card grid and month calendar. Filters: activity, date range, region, difficulty, duration, distance, free/paid, availability, experience level. Status badges: *Open for applications, Full – waitlist, Closed, Completed, Cancelled, Postponed*.

### 4.5 Accounts & profiles (§6) ✅
Required and optional fields exactly as listed. Sensitive data (phone, emergency contact, full last name) is stored separately in `member_private`, readable only by the member, admins, and – for emergency contacts only – organizers of events the member is confirmed for (via an audited function). Member-visible profiles expose only: first name + last initial, optional photo, intro, interests, selected experience, completed-activity count, membership duration, badges.

### 4.6 Membership approval (§7) ✅
Owner setting *Require manual approval*. Statuses: pending, active, restricted, suspended, removed (plus an internal *not approved* outcome for rejected applications). Notifications use member-facing templates; internal notes are stored separately and never sent.

### 4.7 Event applications (§8) ✅
Application with event-specific questions and equipment self-check. Review screen shows experience, history, reliability (attendance rate, no-shows, late cancels), answers, equipment, prior conduct flags, capacity. Batch approve, reject, waitlist, invite, reserved spaces, remove, reopen, confirmation deadline. All ten statuses supported. Capacity is enforced in the database with row locking.

### 4.8 Waivers (§9) ✅
Reusable templates (general / activity / event), immutable versions, “requires re-signing” flag, typed-name electronic signature with timestamp, IP and user agent, snapshot hash, downloadable PDF record, admin access. Confirmation is blocked in the database until all required waivers are signed at the current required version. Every template displays a **“Draft – requires legal review before production use”** banner until the owner marks it reviewed.

### 4.9 Payments (§10) ✅ (Stripe integration requires the owner's Stripe keys)
Per-event price (CAD), optional deposit, allowed methods (online / cash / none), payment deadline. Online payments use Stripe Checkout (no card data touches our servers); webhook records payment. Cash payments are recorded by staff. Refunds (Stripe or cash), receipts, transaction history, outstanding tracking. Members cannot be charged before approval (enforced in the server action and DB function).

### 4.10 Attendance & no-shows (§11) ✅
Outcomes: attended, cancelled within period, late cancellation, excused absence, unexcused no-show, plus *event cancelled* (organizer-side, never penalised). Confirming an unexcused no-show automatically restricts the member (DB trigger). Appeals, warnings, suspension, removal, restoration and confidential notes.

### 4.11 Waitlist (§12) ✅
Ordered waitlist. On cancellation, staff are notified; per-event mode *manual* or *automatic*. Offers carry a configurable acceptance window; expired offers roll to the next person (scheduled job).

### 4.12 Notifications (§13) ✅ (email delivery requires a Resend API key)
In-app notifications for all listed triggers; emails are queued in `email_outbox` and delivered by a scheduled job through Resend. Without a key, emails stay queued and are shown as **“Not sent – email provider not configured”**. Announcements to all members, event participants, waitlisted, groups, or individuals. ICS calendar download for confirmed participants.

### 4.13 Private event page (§14) ✅
Participant list (limited profiles), organizer announcements, meeting instructions, equipment checklist, updates, moderated discussion, carpool board. No private messaging.

### 4.14 Suggestions (§15) ✅
Submit, vote (one per member), admin review and one-click *convert to draft event*.

### 4.15 Member dashboard (§16) ✅
Everything listed, including distance/elevation totals from attended events, standing, appeals, data export and account deletion.

### 4.16 Admin dashboard (§17) ✅
All metrics listed; member search/filter; CSV exports; participation history; event-day roster with attendance checkboxes, payment and waiver status, and audited emergency-contact reveal.

### 4.17 Roles (§18) ✅
Owner, Administrator, Event Organizer (scoped to assigned events), Moderator. Enforced by RLS and by security-definer functions; audit log on all significant actions.

### 4.18 Geography (§19) ✅
Hierarchical `regions` table (country → province → area) seeded with the 13 Lower Mainland areas; owner can add regions/countries in Admin → Settings.

### 4.19 FAQ & policies (§20–21) ✅
Admin-editable FAQ (all 15 topics seeded) and policy pages (all 9 seeded as drafts flagged for legal review). Private reporting of behaviour/safety concerns; organizer incident log, headcounts and *safely departed* confirmation.

### 4.20 Technical (§22) ✅
See `02-data-model-and-roles.md` and `06-implementation-and-testing-plan.md`.

## 5. Selection fairness policy (product rule)

Selection criteria shown to members: relevant experience for the stated difficulty, attendance reliability, equipment readiness, answers to event questions, fair rotation (members not selected recently get priority), group balance for safety (e.g. enough experienced members). Prohibited criteria: appearance, protected characteristics under the BC Human Rights Code, or anything unrelated to the activity. This text is seeded in the FAQ and attendance policy and is editable.

## 6. Honesty about simulated functionality

Demo data is fictional. When integrations are not configured the UI says so explicitly:
- **Stripe** not configured → online payment option hidden from members; admins see a configuration notice.
- **Resend** not configured → emails remain queued and are labelled *not sent*.
- **Demo mode** (no Supabase configured) → public pages render fictional sample data with a persistent “Demo data — not a live community” banner; sign-in and all write actions are disabled.
- **Waivers and policies** → visibly marked as drafts requiring legal review.

## 7. Success metrics

Attendance rate ≥ 90%, no-show rate ≤ 3%, repeat participation ≥ 40% at 6 months, median application review time < 48h, zero sensitive-data exposure incidents.
