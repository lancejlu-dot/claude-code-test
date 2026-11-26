# Pages and Reusable Components

## Public
| Route | Purpose |
| --- | --- |
| `/` | Homepage (hero, values, featured/upcoming, categories, stats, highlights, how it works, FAQ excerpt, CTAs) |
| `/activities` | Discovery: filters, card grid / calendar (`?view=calendar`) |
| `/activities/[slug]` | Event detail, status, apply CTA, restricted logistics |
| `/faq` | Admin-editable FAQ grouped by category |
| `/policies/[slug]` | Guidelines, code of conduct, privacy, terms, cancellation, attendance, safety, harassment reporting, photo consent |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm` | Auth |

## Member (authenticated)
| Route | Purpose |
| --- | --- |
| `/dashboard` | Personal overview: to-dos, upcoming, pending, waitlisted, stats, standing |
| `/dashboard/activities` | All applications & history with actions (cancel, accept offer) |
| `/dashboard/profile` | Profile + private details |
| `/dashboard/notifications` | In-app notifications |
| `/dashboard/payments` | Outstanding & history, receipts |
| `/dashboard/standing` | Account standing, warnings, appeal form |
| `/dashboard/account` | Data export, account deletion, email preferences |
| `/activities/[slug]/apply` | Application form |
| `/activities/[slug]/hub` | Private participant page (discussion, carpool, checklist) |
| `/waivers/[eventId]` | Sign required waivers for an event |
| `/members/[id]` | Limited member profile |
| `/suggestions` | Suggest & vote |
| `/report` | Private report form |

## Admin portal (`/admin`, staff only — layout guard + RLS)
`/admin` stats · `/admin/events` (+ `new`, `[id]`, `[id]/applications`, `[id]/roster`) · `/admin/members` (+ `[id]`) · `/admin/appeals` · `/admin/waivers` (+ `[id]`, signatures) · `/admin/payments` · `/admin/announcements` · `/admin/suggestions` · `/admin/moderation` (reports, hidden posts) · `/admin/incidents` · `/admin/content` (FAQ, policies, homepage, highlights) · `/admin/settings` (owner: brand, approval, regions, categories, staff, retention) · `/admin/audit` · `/admin/reports` (CSV exports).

## Reusable components
- **Layout:** `SiteHeader`, `SiteFooter`, `DemoBanner`, `AdminSidebar`, `MobileNav`, `PageHeader`, `Section`.
- **Event:** `EventCard`, `EventStatusBadge`, `DifficultyBadge`, `EventFacts` (distance/elevation/duration/pace grid), `EventCalendar`, `EventFilters`, `CategoryIcon`, `EventImage` (photo with illustrated fallback).
- **Member:** `MemberCard` (limited profile), `Avatar`, `StandingBadge`, `ApplicationStatusBadge`.
- **Forms:** `Field`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `SubmitButton` (pending state), `FormMessage`, `ConfirmButton`.
- **Admin:** `StatCard`, `DataTable` patterns, `BulkActionBar`, `RosterRow`, `CsvExportLink`.
- **Content:** `Markdown` (safe, no raw HTML), `LegalReviewNotice`, `IntegrationNotice`.
