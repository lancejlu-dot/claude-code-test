# Data Model, Roles and Security

Source of truth: `supabase/migrations/*.sql`. This document explains the design.

## 1. Principles

1. **The database enforces the rules.** Capacity, application state transitions, waiver requirements, payment prerequisites and attendance restrictions live in `SECURITY DEFINER` PL/pgSQL functions. The UI calls these via RPC; direct table writes for those columns are not granted to members.
2. **Row Level Security on every table.** Default deny; policies grant the minimum.
3. **Sensitive data is physically separated** (`member_private`, `event_private_details`, `admin_notes`) so a mistaken `select *` cannot leak it.
4. **Configurable, not hard-coded:** regions, activity categories, FAQ, policies, settings, waiver templates, badges.
5. **Auditable:** every privileged function writes `audit_log`.

## 2. Entity overview

```
auth.users ─1:1─ profiles ─1:1─ member_private (phone, emergency contact, legal last name)
            └─ staff_roles (owner/admin/organizer/moderator)
regions (self-referencing, country→province→area)   activity_categories (default hidden fields)
events ─1:1─ event_private_details (exact meeting point, parking, instructions)
   ├─ event_organizers (organizer / co-organizer)
   ├─ event_waivers → waiver_templates ─1:n─ waiver_versions
   ├─ applications (status, attendance, waitlist position, offer expiry, answers)
   │     ├─ payments ─1:n─ refunds
   │     └─ waiver_signatures (per template version)
   ├─ event_posts (discussion + organizer announcements) → content_reports
   ├─ carpool_offers ─1:n─ carpool_riders
   ├─ headcounts, incidents
suggestions ─1:n─ suggestion_votes          appeals, member_warnings, admin_notes
notifications → email_outbox                announcements → member_groups ─ member_group_members
faqs, policy_pages, site_settings, highlights, badges ─ member_badges, audit_log
```

## 3. Key enums

| Enum | Values |
| --- | --- |
| `member_status` | pending, active, restricted, suspended, removed, rejected |
| `staff_role` | owner, admin, organizer, moderator |
| `event_status` | draft, published, postponed, cancelled, completed |
| `application_status` | submitted, under_review, approved, awaiting_confirmation, confirmed, waitlisted, not_selected, cancelled, attended, no_show |
| `attendance_outcome` | attended, cancelled_in_period, late_cancellation, excused_absence, unexcused_no_show, event_cancelled |
| `payment_status` | pending, paid, refunded, partially_refunded, waived, failed |
| `payment_method` | online, cash, none |

### Application lifecycle

```
submitted ─▶ under_review ─▶ approved ──(waivers ✓, payment ✓/cash, member confirms)──▶ confirmed ─▶ attended
     │             │            │                                                          └──▶ no_show
     │             ├─▶ waitlisted ─(spot opens: offer)─▶ awaiting_confirmation ─(accept)─▶ approved
     │             └─▶ not_selected                      └─(offer expires)─▶ waitlisted (end of queue) / cancelled
     └─(member/admin cancels at any time before attendance)─▶ cancelled
invite_member ─▶ awaiting_confirmation (offer)
```

**Capacity** = count of applications in (approved, awaiting_confirmation, confirmed, attended) + `reserved_spots` ≤ `max_participants`. `invite_member` may consume reserved spots. Enforced inside `approve_applications`, `accept_offer`, `invite_member` and `reopen/promote` with `SELECT … FOR UPDATE` on the event row so concurrent approvals cannot overbook.

### Confirmation prerequisites (`confirm_participation`)
1. Status is `approved`, the confirmation deadline (if any) has not passed.
2. Every waiver attached to the event **and** the general community waiver (if configured) is signed at a version ≥ the latest version flagged `requires_resign`.
3. If the event has a fee: a `paid`/`waived` payment exists **or** cash is an allowed method (recorded as outstanding). If a deposit is required, it must be paid online or waived.

## 4. Roles and permissions matrix

| Capability | Member | Moderator | Organizer (assigned events) | Admin | Owner |
| --- | :-: | :-: | :-: | :-: | :-: |
| Browse published events / apply | ✓ | ✓ | ✓ | ✓ | ✓ |
| View limited member profiles | ✓ (co-participants & public cards) | ✓ | ✓ | ✓ | ✓ |
| Moderate discussions / reports | – | ✓ | own events | ✓ | ✓ |
| Create / edit events | – | – | own events (edit) | ✓ | ✓ |
| Review / approve applications | – | – | own events | ✓ | ✓ |
| Record attendance, headcounts, incidents | – | – | own events | ✓ | ✓ |
| Reveal emergency contacts | – | – | confirmed participants of own events (audited) | ✓ (audited) | ✓ (audited) |
| Member approval, suspension, removal, appeals | – | – | – | ✓ | ✓ |
| Confidential admin notes | – | – | – | ✓ | ✓ |
| Record cash, refunds | – | – | own events (cash only) | ✓ | ✓ |
| Revenue reports, payment settings | – | – | – | – | ✓ |
| Manage staff roles, regions, categories, platform settings | – | – | – | – | ✓ |
| Audit log | – | – | – | ✓ (read) | ✓ (read) |

Implemented through SQL helpers: `is_staff()`, `has_role(role)`, `is_admin()` (admin or owner), `is_owner()`, `is_event_staff(event_id)` (admin or assigned organizer), `is_event_participant(event_id)`.

## 5. Sensitive data handling

- `member_private`: RLS = self or admin. Organizers get emergency contacts only via `get_event_emergency_contacts(event_id)`, which checks assignment, returns only confirmed participants, and logs `audit_log(action='emergency_contacts.viewed')`.
- `public_profiles` view (security barrier, owned by a definer) exposes first name + last initial and the allowed fields only.
- `admin_notes`: admin/owner only. Never joined into member-facing queries.
- `event_private_details`: readable by everyone if `restrict_logistics = false`, otherwise only event staff and members with an approved/confirmed/attended application.
- Payments: no card data stored; only Stripe session/payment-intent IDs.
- Account deletion: `delete_my_account()` anonymises profile and private data, cancels future applications, deletes discussion content authorship, and keeps waiver signature and payment records (legal/financial retention) linked to an anonymised ID for the configured retention period.
- Retention: `site_settings.retention` controls purge windows for notifications, email outbox, audit log and anonymised records (`purge_expired_data()` scheduled job).

## 6. Geographic expansion

`regions(id, parent_id, kind country|province|area, name, slug, active, sort)`. Events reference an *area*; filters accept any region and include descendants (recursive CTE in `region_descendants()`). Adding *Vancouver Island* or *Calgary* is a data change only. Currency and time zone are columns on `regions` (country/province level), defaulting to CAD and `America/Vancouver`.

## 7. Storage buckets

| Bucket | Visibility | Contents |
| --- | --- | --- |
| `event-media` | public | cover & gallery photos, highlights (consent flag enforced at upload form + DB) |
| `avatars` | public | optional profile photos (path prefixed by user id; only owner can write) |
| `private-records` | private | generated waiver PDFs, incident attachments (staff only via signed URLs) |
