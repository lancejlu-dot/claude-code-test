# Launch-critical vs Future Enhancements

## Phase 1 — Core platform (launch-critical) ✅ built
- Schema, RLS, role helpers, audit log, regions, categories, settings
- Auth: sign-up with required fields & consents, email verification, password recovery
- Membership approval workflow & statuses
- Event CRUD with full field set, hidden fields, restricted logistics, duplicate / publish / postpone / cancel / delete
- Discovery (filters, cards, calendar), event detail
- Applications with questions, capacity-safe approvals, batch actions, waitlist, invitations, reserved spots
- Member dashboard; admin dashboard & member management
- FAQ and policy pages (admin editable)

## Phase 2 — Safety, waivers, payments (launch-critical) ✅ built
- Waiver templates, versions, re-sign, e-signature, PDF record, confirmation gating
- Stripe Checkout + webhook, cash recording, refunds, receipts, deposits, outstanding tracking
- Attendance outcomes, automatic no-show restriction, appeals, warnings, notes
- Event-day roster, emergency contacts (audited), headcounts, safe-departure, incidents
- Notifications + email outbox + Resend dispatcher, announcements, ICS calendar

## Phase 3 — Community (launch-desirable) ✅ built
- Private event hub: discussion, organizer announcements, carpool board, checklist
- Suggestions with voting and convert-to-draft
- Moderation queue and private reports
- Highlights with consent, badges (manual award), data export, account deletion, retention purge

## Future enhancements (not built)
- Automated badge rules (e.g. “10 hikes”) — schema ready, award is manual today
- Weather API integration for automatic advisories (manual weather cancellations exist)
- SMS notifications (Twilio) for day-of changes
- Map view with geocoded meeting points (requires a maps provider and privacy review)
- Two-factor authentication for staff (Supabase MFA) — strongly recommended before launch
- Offline-capable roster (PWA) for trailheads with no signal
- Multi-language UI (French) and multi-currency
- Advanced analytics (cohort retention) and organizer payouts
- Recurring event series
