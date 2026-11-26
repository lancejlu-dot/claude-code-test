# User Journeys

## Member journeys

### J1 — Join the community
1. Visitor lands on homepage → reads values, FAQ, policies.
2. **Join** → sign-up form (required fields, 18+ confirmation, guideline + privacy/terms acceptance; consent timestamps stored).
3. Email verification link (Supabase Auth) → `/auth/confirm`.
4. If manual approval is on: status `pending`, dashboard shows “Your membership is being reviewed”. Admin approves → notification + email → status `active`.
5. Optional: complete profile (interests, experience, availability, vehicle/carpool, certifications, photo).

### J2 — Find and apply for an activity
1. `/activities` → filter (e.g. *Hiking · North Shore · Moderate · Free · Open*), card or calendar view.
2. Event page → full details; restricted logistics show “Shared with approved participants”.
3. **Apply** (active members only; blocked server-side otherwise) → answers event questions, equipment checklist self-assessment, note to organizer.
4. Status `submitted` → notification “Application received — applying doesn't guarantee a spot”.

### J3 — Selected → confirmed
1. Organizer approves → status `approved`, notification with confirmation deadline.
2. Member's to-do list: sign waiver(s) → pay online (Stripe Checkout) or choose cash → **Confirm attendance**.
3. DB verifies waivers + payment → `confirmed`. Private event page unlocks; ICS download.
4. Reminders 48h and morning-of (scheduled job).

### J4 — Waitlist offer
1. Event is full → member placed on waitlist (position shown).
2. A confirmed member cancels → staff notified; in *automatic* mode the next waitlisted member gets an offer (`awaiting_confirmation`, expires in N hours).
3. Member accepts → `approved` → J3 steps. Ignored offer → expires → next member offered.

### J5 — Cancel participation
1. Dashboard → **Cancel**. UI states whether the cancellation is within the permitted period and what the refund policy says.
2. Before deadline → `cancelled_in_period` (no penalty); after → `late_cancellation` (recorded, not automatically restricted; repeated late cancels are visible to admins).

### J6 — No-show → restriction → appeal
1. Organizer marks unexcused no-show; admin confirms → member automatically `restricted`, notification.
2. Member dashboard shows standing + **Submit explanation** form.
3. Admin reviews → approve (restore, optionally with a warning) or reject; member notified of the decision only.

### J7 — Suggest an activity
Member submits suggestion → others vote → admin converts to a draft event prefilled with name, category, location, difficulty, link.

### J8 — Report a concern
Any page/post → **Report** → private form to moderators/admins; reporter never exposed to the reported member.

### J9 — Manage personal data
Account page → export my data (JSON) → delete account (confirmation; explains what is retained and why).

## Staff journeys

### A1 — Membership queue (Admin)
Admin → Members → *Pending* filter → review intro + profile → approve / reject (with member-facing message) / add confidential note.

### A2 — Create an event (Admin/Owner)
Events → New (or Duplicate / from suggestion) → category picks default visible fields → fill details, questions, equipment, waivers, pricing & payment methods, capacity, reserved spots, deadlines, waitlist mode, organizers, logistics restriction → **Save draft** → preview → **Publish**.

### A3 — Select participants (Organizer/Admin)
Event → Applications → sort/filter by reliability, experience, answers → select several → **Approve** (capacity check) / **Waitlist** / **Not selected**; invite specific members; set confirmation deadline; reopen registration.

### A4 — Event day (Organizer)
Roster (mobile) → check in attendees, see payment & waiver status, record cash → headcount at start / turnaround / finish → **Mark safely departed** → record incident if needed → emergency contacts available behind a reveal button (audited).

### A5 — After the event
Mark remaining attendance outcomes → no-shows confirmed by admin → event `completed` → highlights uploaded with consent flag.

### A6 — Communications
Announcements → audience (all / event participants / waitlisted / group / individual) → in-app + email queue.

### A7 — Owner configuration
Settings → brand, approval requirement, general waiver, default cancellation window, retention windows, regions, categories, staff roles; Content → homepage, FAQ, policies.
