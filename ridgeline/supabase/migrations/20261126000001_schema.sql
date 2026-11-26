-- =============================================================================
-- Ridgeline Collective — core schema
-- Targets Supabase Postgres 15+. Relies on the Supabase `auth` schema
-- (auth.users, auth.uid()). All tables have RLS enabled in a later migration.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_status as enum ('pending','active','restricted','suspended','removed','rejected');
create type public.staff_role as enum ('owner','admin','organizer','moderator');
create type public.event_status as enum ('draft','published','postponed','cancelled','completed');
create type public.application_status as enum (
  'submitted','under_review','approved','awaiting_confirmation','confirmed',
  'waitlisted','not_selected','cancelled','attended','no_show');
create type public.attendance_outcome as enum (
  'attended','cancelled_in_period','late_cancellation','excused_absence','unexcused_no_show','event_cancelled');
create type public.payment_status as enum ('pending','paid','refunded','partially_refunded','waived','failed');
create type public.payment_method as enum ('online','cash','none');
create type public.payment_kind as enum ('fee','deposit');
create type public.difficulty as enum ('easy','moderate','challenging','strenuous','expert');
create type public.experience_level as enum ('none','beginner','intermediate','advanced','expert');
create type public.waiver_kind as enum ('general','activity','event');
create type public.region_kind as enum ('country','province','area');
create type public.waitlist_mode as enum ('manual','automatic');
create type public.appeal_status as enum ('submitted','under_review','approved','rejected');
create type public.report_status as enum ('open','in_review','resolved','dismissed');
create type public.suggestion_status as enum ('submitted','under_review','planned','converted','declined');
create type public.announcement_audience as enum ('all_members','event_participants','event_waitlisted','group','individual');

-- ---------------------------------------------------------------------------
-- Configuration: regions, categories, settings
-- ---------------------------------------------------------------------------
create table public.regions (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.regions(id) on delete restrict,
  kind        public.region_kind not null default 'area',
  name        text not null,
  slug        text not null unique,
  currency    char(3) default 'CAD',
  time_zone   text default 'America/Vancouver',
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.activity_categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text,
  icon            text not null default 'mountain',
  -- Event fields hidden by default for this category (see lib/event-fields.ts)
  hidden_fields   text[] not null default '{}',
  tracks_distance boolean not null default true,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- Key/value settings editable by the owner. Values are JSON.
create table public.site_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  first_name             text not null,
  last_initial           char(1) not null,
  avatar_url             text,
  intro                  text not null default '',
  status                 public.member_status not null default 'pending',
  status_reason          text,              -- member-facing explanation (never internal notes)
  status_changed_at      timestamptz,
  restricted_until       timestamptz,
  -- optional profile information
  interests              text[] not null default '{}',   -- category slugs
  home_region_id         uuid references public.regions(id) on delete set null,
  city                   text,
  hiking_experience      public.experience_level,
  experience_summary     text,
  preferred_difficulty   public.difficulty,
  fitness_self_assessment text,
  preferred_pace         text,
  weekend_availability   text[] not null default '{}',   -- e.g. {saturday,sunday}
  languages              text[] not null default '{}',
  has_vehicle            boolean,
  willing_to_carpool     boolean,
  skills_certifications  text[] not null default '{}',
  -- member visibility choices
  show_experience        boolean not null default true,
  email_notifications    boolean not null default true,
  -- consent records
  age_confirmed_at       timestamptz not null,
  guidelines_accepted_at timestamptz not null,
  privacy_accepted_at    timestamptz not null,
  terms_accepted_at      timestamptz not null,
  photo_consent          boolean not null default false,
  -- lifecycle
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index profiles_status_idx on public.profiles(status);

-- Sensitive contact details. Separate table so it can never be selected by accident.
create table public.member_private (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  last_name                text not null,
  email                    citext not null,
  phone                    text not null,
  emergency_contact_name   text not null,
  emergency_contact_phone  text not null,
  emergency_contact_relationship text,
  medical_notes            text,         -- optional, member-provided, shared only like emergency contacts
  updated_at               timestamptz not null default now()
);

create table public.staff_roles (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.staff_role not null,
  granted_by  uuid references public.profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.member_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);
create table public.member_group_members (
  group_id uuid not null references public.member_groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, user_id)
);

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  icon        text not null default 'award',
  created_at  timestamptz not null default now()
);
create table public.member_badges (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ---------------------------------------------------------------------------
-- Waivers
-- ---------------------------------------------------------------------------
create table public.waiver_templates (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  kind               public.waiver_kind not null,
  category_id        uuid references public.activity_categories(id) on delete set null,
  description        text,
  current_version    int not null default 0,
  legal_reviewed     boolean not null default false,  -- owner flips after legal review
  legal_reviewed_at  timestamptz,
  active             boolean not null default true,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Immutable versions. A new version flagged requires_resign invalidates older signatures.
create table public.waiver_versions (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.waiver_templates(id) on delete cascade,
  version         int not null,
  body            text not null,
  change_summary  text,
  requires_resign boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (template_id, version)
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  title                   text not null,
  category_id             uuid not null references public.activity_categories(id),
  region_id               uuid references public.regions(id),
  status                  public.event_status not null default 'draft',
  featured                boolean not null default false,
  cover_image_url         text,
  gallery_urls            text[] not null default '{}',
  summary                 text,
  description             text not null default '',
  starts_at               timestamptz not null,
  ends_at                 timestamptz,                -- estimated finishing time
  time_zone               text not null default 'America/Vancouver',
  general_location        text,
  distance_km             numeric(6,1),
  elevation_gain_m        int,
  duration_minutes        int,
  difficulty              public.difficulty,
  group_pace              text,
  required_experience     public.experience_level not null default 'none',
  experience_notes        text,
  fitness_expectations    text,
  required_equipment      text[] not null default '{}',
  recommended_equipment   text[] not null default '{}',
  food_water              text,
  transportation          text,
  carpool_enabled         boolean not null default true,
  weather_considerations  text,
  safety_information      text,
  max_participants        int not null check (max_participants > 0),
  reserved_spots          int not null default 0 check (reserved_spots >= 0),
  registration_opens_at   timestamptz,
  registration_deadline   timestamptz,
  cancellation_deadline   timestamptz,
  confirmation_hours      int default 48,         -- hours an approved member has to confirm
  registration_open       boolean not null default true,  -- admin can close/reopen manually
  waitlist_enabled        boolean not null default true,
  waitlist_mode           public.waitlist_mode not null default 'manual',
  waitlist_offer_hours    int not null default 24,
  price_cents             int not null default 0 check (price_cents >= 0),
  deposit_cents           int not null default 0 check (deposit_cents >= 0),
  currency                char(3) not null default 'CAD',
  payment_methods         public.payment_method[] not null default '{none}',
  payment_deadline        timestamptz,
  cancellation_policy     text,
  external_links          jsonb not null default '[]',  -- [{label,url}]
  custom_sections         jsonb not null default '[]',  -- [{title, items:[...]}]
  application_questions   jsonb not null default '[]',  -- [{id,label,help,required,type:'text'|'yesno'}]
  hidden_fields           text[] not null default '{}',
  restrict_logistics      boolean not null default true,
  status_note             text,     -- e.g. reason for postponement/cancellation
  weather_cancellation    boolean not null default false,
  source_suggestion_id    uuid,
  published_at            timestamptz,
  cancelled_at            timestamptz,
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check (reserved_spots <= max_participants)
);
create index events_starts_idx on public.events(starts_at);
create index events_status_idx on public.events(status);
create index events_category_idx on public.events(category_id);
create index events_region_idx on public.events(region_id);

-- Logistics that may be restricted to approved participants.
create table public.event_private_details (
  event_id                 uuid primary key references public.events(id) on delete cascade,
  meeting_location         text,
  meeting_location_url     text,
  meeting_time_note        text,
  parking_information      text,
  carpool_details          text,
  additional_instructions  text,
  organizer_phone_note     text,
  updated_at               timestamptz not null default now()
);

create table public.event_organizers (
  event_id  uuid not null references public.events(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  is_lead   boolean not null default false,
  primary key (event_id, user_id)
);

create table public.event_waivers (
  event_id    uuid not null references public.events(id) on delete cascade,
  template_id uuid not null references public.waiver_templates(id) on delete restrict,
  primary key (event_id, template_id)
);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create table public.applications (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.events(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  status                public.application_status not null default 'submitted',
  answers               jsonb not null default '{}',
  equipment_confirmed   text[] not null default '{}',
  note_to_organizer     text,
  experience_statement  text,
  wants_carpool         boolean,
  can_drive_seats       int,
  invited               boolean not null default false,
  waitlist_position     int,
  offer_expires_at      timestamptz,
  confirm_by            timestamptz,
  attendance            public.attendance_outcome,
  attendance_recorded_by uuid references public.profiles(id) on delete set null,
  attendance_recorded_at timestamptz,
  no_show_confirmed     boolean not null default false,
  checked_in_at         timestamptz,
  departed_safely_at    timestamptz,
  cancellation_reason   text,
  cancelled_at          timestamptz,
  decided_by            uuid references public.profiles(id) on delete set null,
  decided_at            timestamptz,
  decision_message      text,     -- member-facing message
  confirmed_at          timestamptz,
  payment_choice        public.payment_method,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (event_id, user_id)
);
create index applications_user_idx on public.applications(user_id);
create index applications_event_status_idx on public.applications(event_id, status);

create table public.waiver_signatures (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete restrict,
  template_id      uuid not null references public.waiver_templates(id) on delete restrict,
  version_id       uuid not null references public.waiver_versions(id) on delete restrict,
  version          int not null,
  event_id         uuid references public.events(id) on delete set null,
  application_id   uuid references public.applications(id) on delete set null,
  signature_name   text not null,
  signer_display   text not null,   -- snapshot of member name at signing
  body_sha256      text not null,   -- hash of the exact text accepted
  ip_address       inet,
  user_agent       text,
  signed_at        timestamptz not null default now()
);
create index waiver_signatures_user_idx on public.waiver_signatures(user_id, template_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id                        uuid primary key default gen_random_uuid(),
  application_id            uuid not null references public.applications(id) on delete restrict,
  event_id                  uuid not null references public.events(id) on delete restrict,
  user_id                   uuid not null references public.profiles(id) on delete restrict,
  kind                      public.payment_kind not null default 'fee',
  method                    public.payment_method not null,
  status                    public.payment_status not null default 'pending',
  amount_cents              int not null check (amount_cents >= 0),
  refunded_cents            int not null default 0,
  currency                  char(3) not null default 'CAD',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id  text,
  receipt_number            text unique,
  recorded_by               uuid references public.profiles(id) on delete set null,
  notes                     text,
  paid_at                   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index payments_app_idx on public.payments(application_id);
create index payments_status_idx on public.payments(status);
create sequence public.receipt_seq start 1001;

create table public.refunds (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references public.payments(id) on delete restrict,
  amount_cents     int not null check (amount_cents > 0),
  reason           text,
  method           public.payment_method not null,
  stripe_refund_id text unique,
  processed_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accountability: warnings, appeals, confidential notes
-- ---------------------------------------------------------------------------
create table public.member_warnings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event_id    uuid references public.events(id) on delete set null,
  message     text not null,          -- member-facing
  issued_by   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.appeals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  application_id  uuid references public.applications(id) on delete set null,
  explanation     text not null,
  status          public.appeal_status not null default 'submitted',
  decision_message text,               -- member-facing
  decided_by      uuid references public.profiles(id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table public.admin_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event_id    uuid references public.events(id) on delete set null,
  body        text not null,
  author_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Event community: posts, carpool, safety
-- ---------------------------------------------------------------------------
create table public.event_posts (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  author_id       uuid references public.profiles(id) on delete set null,
  body            text not null check (char_length(body) between 1 and 4000),
  is_announcement boolean not null default false,
  pinned          boolean not null default false,
  hidden          boolean not null default false,
  hidden_by       uuid references public.profiles(id) on delete set null,
  hidden_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index event_posts_event_idx on public.event_posts(event_id, created_at);

create table public.carpool_offers (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  driver_id    uuid not null references public.profiles(id) on delete cascade,
  seats        int not null check (seats between 1 and 8),
  departure_area text not null,
  departure_time_note text,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (event_id, driver_id)
);
create table public.carpool_riders (
  offer_id   uuid not null references public.carpool_offers(id) on delete cascade,
  rider_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, rider_id)
);

create table public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles(id) on delete set null,
  subject_user_id  uuid references public.profiles(id) on delete set null,
  event_id         uuid references public.events(id) on delete set null,
  post_id          uuid references public.event_posts(id) on delete set null,
  category         text not null,  -- harassment, safety, misconduct, content, other
  details          text not null,
  status           public.report_status not null default 'open',
  resolution_note  text,           -- internal
  handled_by       uuid references public.profiles(id) on delete set null,
  handled_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table public.headcounts (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  label        text not null,       -- e.g. Trailhead start, Summit, Return to cars
  counted      int not null check (counted >= 0),
  expected     int not null check (expected >= 0),
  notes        text,
  recorded_by  uuid references public.profiles(id) on delete set null,
  recorded_at  timestamptz not null default now()
);

create table public.incidents (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  severity      text not null check (severity in ('minor','moderate','serious','critical')),
  occurred_at   timestamptz not null default now(),
  summary       text not null,
  details       text,
  actions_taken text,
  people_involved uuid[] not null default '{}',
  emergency_services_contacted boolean not null default false,
  follow_up_required boolean not null default false,
  resolved      boolean not null default false,
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------------
create table public.suggestions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,
  name               text not null,
  location           text,
  category_id        uuid references public.activity_categories(id) on delete set null,
  preferred_timing   text,
  difficulty         public.difficulty,
  external_link      text,
  explanation        text,
  willing_to_help    boolean not null default false,
  status             public.suggestion_status not null default 'submitted',
  admin_response     text,
  converted_event_id uuid references public.events(id) on delete set null,
  created_at         timestamptz not null default now()
);
create table public.suggestion_votes (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
alter table public.events add constraint events_source_suggestion_fk
  foreign key (source_suggestion_id) references public.suggestions(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Communication
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null default '',
  link        text,
  event_id    uuid references public.events(id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.email_outbox (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid references public.notifications(id) on delete set null,
  user_id          uuid references public.profiles(id) on delete set null,
  to_email         text not null,
  subject          text not null,
  body_text        text not null,
  status           text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  attempts         int not null default 0,
  last_error       text,
  provider_message_id text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index email_outbox_status_idx on public.email_outbox(status, created_at);

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  audience    public.announcement_audience not null,
  event_id    uuid references public.events(id) on delete set null,
  group_id    uuid references public.member_groups(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  title       text not null,
  body        text not null,
  recipient_count int not null default 0,
  sent_by     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Content: FAQ, policies, highlights
-- ---------------------------------------------------------------------------
create table public.faqs (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  question    text not null,
  answer      text not null,
  sort_order  int not null default 0,
  published   boolean not null default true,
  show_on_home boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table public.policy_pages (
  slug          text primary key,
  title         text not null,
  summary       text,
  body          text not null,
  legal_reviewed boolean not null default false,
  published     boolean not null default true,
  sort_order    int not null default 0,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);

create table public.highlights (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid references public.events(id) on delete set null,
  title             text not null,
  caption           text,
  image_url         text not null,
  consent_confirmed boolean not null default false,
  published         boolean not null default true,
  sort_order        int not null default 0,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  -- A highlight may only be published when every pictured member consented.
  check (not published or consent_confirmed)
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_entity_idx on public.audit_log(entity, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','member_private','events','event_private_details','applications',
                           'payments','event_posts','waiver_templates','faqs','policy_pages','site_settings']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
