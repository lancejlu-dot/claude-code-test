-- =============================================================================
-- Ridgeline Collective — helpers and business rules
-- Every state-changing business operation is a SECURITY DEFINER function.
-- Members and staff cannot write applications, payments, signatures, appeals
-- or statuses directly; RLS + grants (next migration) enforce that.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role & state helpers
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.staff_role, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from staff_roles where user_id = p_uid and role = p_role);
$$;

create or replace function public.is_owner(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.has_role('owner', p_uid);
$$;

create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from staff_roles where user_id = p_uid and role in ('owner','admin'));
$$;

create or replace function public.is_staff(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from staff_roles where user_id = p_uid);
$$;

create or replace function public.is_moderator(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from staff_roles where user_id = p_uid and role in ('owner','admin','moderator'));
$$;

-- Admin, or an organizer assigned to this event.
create or replace function public.is_event_staff(p_event uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin(p_uid)
      or exists (select 1 from event_organizers eo where eo.event_id = p_event and eo.user_id = p_uid);
$$;

-- Member selected for the event (may see restricted logistics & the private event page).
create or replace function public.is_event_participant(p_event uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from applications a
                 where a.event_id = p_event and a.user_id = p_uid
                   and a.status in ('approved','confirmed','attended'));
$$;

create or replace function public.my_status()
returns public.member_status language sql stable security definer set search_path = public, pg_temp as $$
  select status from profiles where id = auth.uid();
$$;

create or replace function public.setting(p_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select value from site_settings where key = p_key;
$$;

create or replace function public.require_auth()
returns uuid language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return v;
end $$;

create or replace function public.require_admin()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v uuid := public.require_auth();
begin
  if not public.is_admin(v) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return v;
end $$;

create or replace function public.require_event_staff(p_event uuid)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v uuid := public.require_auth();
begin
  if not public.is_event_staff(p_event, v) then
    raise exception 'You are not an organizer of this event' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Notifications (+ email outbox)
-- ---------------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text,
                                         p_link text default null, p_event uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into notifications(user_id, type, title, body, link, event_id)
  values (p_user, p_type, p_title, coalesce(p_body, ''), p_link, p_event)
  returning id into v_id;
  return v_id;
end $$;

-- Critical notifications are emailed even when a member opted out of email.
create or replace function public.queue_notification_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text; v_pref boolean; v_deleted timestamptz;
  v_site text := coalesce(public.setting('site_url') #>> '{}', '');
  v_brand text := coalesce(public.setting('brand') ->> 'name', 'Ridgeline Collective');
  v_critical text[] := array['membership_decision','event_cancelled','event_changed','weather_cancellation',
                             'no_show_restriction','appeal_decision','account_status','spot_available'];
begin
  select mp.email, p.email_notifications, p.deleted_at into v_email, v_pref, v_deleted
  from profiles p left join member_private mp on mp.user_id = p.id where p.id = new.user_id;
  if v_email is null or v_deleted is not null then return new; end if;
  if not v_pref and not (new.type = any(v_critical)) then return new; end if;
  insert into email_outbox(notification_id, user_id, to_email, subject, body_text)
  values (new.id, new.user_id, v_email, new.title,
          new.body || case when new.link is not null then E'\n\n' || v_site || new.link else '' end
          || E'\n\n— ' || v_brand
          || E'\nYou can change email preferences in your account settings.');
  return new;
end $$;
create trigger notifications_email after insert on public.notifications
  for each row execute function public.queue_notification_email();

create or replace function public.notify_event_staff(p_event uuid, p_type text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in
    select distinct u from (
      select user_id u from event_organizers where event_id = p_event
      union select user_id from staff_roles where role in ('owner','admin')
    ) s
  loop
    perform public.notify(r.u, p_type, p_title, p_body, p_link, p_event);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap (runs inside Supabase Auth sign-up)
-- Required fields and consents are validated here so they cannot be skipped
-- by calling the Auth API directly.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_status member_status;
  f text;
begin
  foreach f in array array['first_name','last_name','phone','emergency_contact_name','emergency_contact_phone','intro']
  loop
    if coalesce(btrim(m ->> f), '') = '' then
      raise exception 'Missing required registration field: %', f using errcode = '23502';
    end if;
  end loop;
  foreach f in array array['age_confirmed','guidelines_accepted','privacy_accepted','terms_accepted']
  loop
    if coalesce((m ->> f)::boolean, false) is not true then
      raise exception 'Registration requires: %', f using errcode = '23514';
    end if;
  end loop;

  v_status := case when coalesce((public.setting('require_member_approval') #>> '{}')::boolean, true)
                   then 'pending' else 'active' end;

  insert into profiles(id, first_name, last_initial, intro, status, status_changed_at,
                       age_confirmed_at, guidelines_accepted_at, privacy_accepted_at, terms_accepted_at, photo_consent)
  values (new.id, btrim(m ->> 'first_name'), upper(left(btrim(m ->> 'last_name'), 1)), btrim(m ->> 'intro'),
          v_status, now(), now(), now(), now(), now(), coalesce((m ->> 'photo_consent')::boolean, false));

  insert into member_private(user_id, last_name, email, phone, emergency_contact_name, emergency_contact_phone,
                             emergency_contact_relationship)
  values (new.id, btrim(m ->> 'last_name'), new.email, btrim(m ->> 'phone'),
          btrim(m ->> 'emergency_contact_name'), btrim(m ->> 'emergency_contact_phone'),
          nullif(btrim(m ->> 'emergency_contact_relationship'), ''));

  if v_status = 'pending' then
    perform public.notify(new.id, 'membership_submitted', 'Welcome — your membership is being reviewed',
      'Thanks for joining. An administrator reviews every new member, usually within 2 days. We will let you know as soon as you are approved.',
      '/dashboard');
    perform public.notify(s.user_id, 'membership_pending', 'New member awaiting approval',
      btrim(m ->> 'first_name') || ' ' || upper(left(btrim(m ->> 'last_name'),1)) || '. has requested to join.',
      '/admin/members?status=pending')
    from staff_roles s where s.role in ('owner','admin');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email in sync when a member changes it through Auth.
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.email is distinct from old.email then
    update member_private set email = new.email where user_id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Last initial follows the private last name.
create or replace function public.sync_last_initial() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update profiles set last_initial = upper(left(btrim(new.last_name), 1)) where id = new.user_id;
  return new;
end $$;
create trigger member_private_last_initial after update of last_name on public.member_private
  for each row execute function public.sync_last_initial();

-- One-time owner bootstrap. Run from the Supabase SQL editor (service role only).
create or replace function public.bootstrap_owner(p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid;
begin
  select user_id into v from member_private where email = p_email;
  if v is null then raise exception 'No member with email %', p_email; end if;
  insert into staff_roles(user_id, role) values (v, 'owner') on conflict do nothing;
  insert into staff_roles(user_id, role) values (v, 'admin') on conflict do nothing;
  update profiles set status = 'active', status_changed_at = now() where id = v;
  insert into audit_log(actor_id, action, entity, entity_id) values (v, 'owner.bootstrapped', 'profile', v::text);
end $$;

-- ---------------------------------------------------------------------------
-- Guards against direct writes to protected columns
-- (inside SECURITY DEFINER functions current_user is the function owner).
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_columns() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    if new.status is distinct from old.status or new.status_reason is distinct from old.status_reason
       or new.restricted_until is distinct from old.restricted_until or new.last_initial is distinct from old.last_initial
       or new.deleted_at is distinct from old.deleted_at or new.id is distinct from old.id
       or new.age_confirmed_at is distinct from old.age_confirmed_at
       or new.guidelines_accepted_at is distinct from old.guidelines_accepted_at
       or new.privacy_accepted_at is distinct from old.privacy_accepted_at
       or new.terms_accepted_at is distinct from old.terms_accepted_at then
      raise exception 'These account fields can only be changed by an administrator' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_columns();

create or replace function public.guard_event_columns() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      if new.status <> 'draft' then
        raise exception 'New events start as drafts; use Publish' using errcode = '42501';
      end if;
    elsif new.status is distinct from old.status or new.published_at is distinct from old.published_at
       or new.cancelled_at is distinct from old.cancelled_at
       or new.weather_cancellation is distinct from old.weather_cancellation then
      raise exception 'Use the publish / postpone / cancel actions to change event status' using errcode = '42501';
    end if;
    -- Capacity cannot be reduced below the number of spots already given out.
    if tg_op = 'UPDATE' and new.max_participants < (select count(*) from applications a
        where a.event_id = new.id and a.status in ('approved','awaiting_confirmation','confirmed','attended')) then
      raise exception 'Maximum participants cannot be lower than the number of selected participants' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger events_guard before insert or update on public.events
  for each row execute function public.guard_event_columns();

create or replace function public.audit_event_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_changed text[];
begin
  if tg_op = 'INSERT' then
    perform public.audit('event.created', 'event', new.id::text, jsonb_build_object('title', new.title));
  else
    select array_agg(key) into v_changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at') and n.value is distinct from (to_jsonb(old) -> n.key);
    if v_changed is not null then
      perform public.audit('event.updated', 'event', new.id::text, jsonb_build_object('fields', v_changed));
    end if;
  end if;
  return new;
end $$;
create trigger events_audit after insert or update on public.events
  for each row execute function public.audit_event_change();

-- ---------------------------------------------------------------------------
-- Capacity & status
-- ---------------------------------------------------------------------------
create or replace function public.event_spots_taken(p_event uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from applications
  where event_id = p_event and status in ('approved','awaiting_confirmation','confirmed','attended');
$$;

create or replace function public.event_waitlist_count(p_event uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from applications where event_id = p_event and status = 'waitlisted';
$$;

create or replace function public.event_spots_left(p_event uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(e.max_participants - e.reserved_spots - public.event_spots_taken(e.id), 0)
  from events e where e.id = p_event;
$$;

-- Member-facing status label used by cards and filters.
create or replace function public.event_public_status(p_event uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when e.status = 'draft' then 'draft'
    when e.status = 'cancelled' then 'cancelled'
    when e.status = 'completed' or coalesce(e.ends_at, e.starts_at) < now() then 'completed'
    when e.status = 'postponed' then 'postponed'
    when e.registration_opens_at is not null and e.registration_opens_at > now() then 'upcoming'
    when not e.registration_open
      or (e.registration_deadline is not null and e.registration_deadline < now())
      or e.starts_at <= now() then 'closed'
    when public.event_spots_left(e.id) = 0 then case when e.waitlist_enabled then 'waitlist' else 'full' end
    else 'open'
  end
  from events e where e.id = p_event;
$$;

-- Lock an event row for capacity-sensitive changes and return free spots.
-- p_use_reserved: invitations may use spaces the organizer reserved.
create or replace function public.lock_event_capacity(p_event uuid, p_use_reserved boolean default false)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_max int; v_res int; v_taken int;
begin
  select max_participants, reserved_spots into v_max, v_res from events where id = p_event for update;
  if v_max is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  v_taken := public.event_spots_taken(p_event);
  return v_max - v_taken - case when p_use_reserved then 0 else v_res end;
end $$;

create or replace function public.default_confirm_by(p_event uuid)
returns timestamptz language sql stable security definer set search_path = public, pg_temp as $$
  select case when e.confirmation_hours is null then null
              else least(now() + make_interval(hours => e.confirmation_hours), e.starts_at - interval '2 hours') end
  from events e where e.id = p_event;
$$;

-- ---------------------------------------------------------------------------
-- Membership administration
-- ---------------------------------------------------------------------------
create or replace function public.set_member_status(p_user uuid, p_status public.member_status,
    p_member_message text default null, p_internal_note text default null, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); v_old member_status; v_title text; v_body text;
begin
  if p_user = v_actor then raise exception 'You cannot change your own membership status'; end if;
  if public.is_owner(p_user) and not public.is_owner(v_actor) then
    raise exception 'Only an owner can change another owner''s status' using errcode = '42501';
  end if;
  select status into v_old from profiles where id = p_user for update;
  if v_old is null then raise exception 'Member not found'; end if;

  update profiles set status = p_status, status_reason = p_member_message, status_changed_at = now(),
         restricted_until = case when p_status in ('restricted','suspended') then p_until else null end
  where id = p_user;

  if p_internal_note is not null and btrim(p_internal_note) <> '' then
    insert into admin_notes(user_id, body, author_id) values (p_user, p_internal_note, v_actor);
  end if;

  -- Removed/suspended members lose upcoming places (no attendance penalty).
  if p_status in ('removed','suspended','rejected') then
    update applications a set status = 'cancelled', cancelled_at = now(),
           cancellation_reason = 'Membership status changed'
    from events e
    where a.event_id = e.id and a.user_id = p_user and e.starts_at > now()
      and a.status in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted');
  end if;

  v_title := case p_status
    when 'active' then case when v_old = 'pending' then 'Welcome! Your membership is approved' else 'Your account is active again' end
    when 'rejected' then 'Update on your membership application'
    when 'restricted' then 'Your booking privileges are temporarily restricted'
    when 'suspended' then 'Your membership has been suspended'
    when 'removed' then 'Your membership has ended'
    else 'Your membership status changed' end;
  v_body := coalesce(nullif(btrim(p_member_message), ''), case p_status
    when 'active' then 'You can now apply for activities. See what is coming up on the activities page.'
    when 'rejected' then 'Thank you for your interest. We are not able to approve your membership at this time.'
    when 'restricted' then 'You cannot apply for new activities right now. You can submit an explanation from your account standing page.'
    when 'suspended' then 'Please review the community guidelines. You can submit an appeal from your account standing page.'
    else 'Please contact the community team if you have questions.' end);
  perform public.notify(p_user, case when v_old = 'pending' then 'membership_decision' else 'account_status' end,
                        v_title, v_body, '/dashboard/standing');
  perform public.audit('member.status_changed', 'profile', p_user::text,
                       jsonb_build_object('from', v_old, 'to', p_status));
end $$;

create or replace function public.issue_warning(p_user uuid, p_message text, p_event uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin();
begin
  insert into member_warnings(user_id, event_id, message, issued_by) values (p_user, p_event, p_message, v_actor);
  perform public.notify(p_user, 'warning', 'A note from the community team', p_message, '/dashboard/standing');
  perform public.audit('member.warning_issued', 'profile', p_user::text, '{}');
end $$;

create or replace function public.add_admin_note(p_user uuid, p_body text, p_event uuid default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin();
begin
  insert into admin_notes(user_id, event_id, body, author_id) values (p_user, p_event, p_body, v_actor);
  perform public.audit('member.note_added', 'profile', p_user::text, '{}');
end $$;

create or replace function public.set_staff_role(p_user uuid, p_role public.staff_role, p_grant boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_auth();
begin
  if not public.is_owner(v_actor) then raise exception 'Only an owner can manage administrators' using errcode = '42501'; end if;
  if p_grant then
    insert into staff_roles(user_id, role, granted_by) values (p_user, p_role, v_actor) on conflict do nothing;
  else
    if p_role = 'owner' and (select count(*) from staff_roles where role = 'owner') <= 1 then
      raise exception 'The platform must keep at least one owner';
    end if;
    delete from staff_roles where user_id = p_user and role = p_role;
  end if;
  perform public.audit(case when p_grant then 'staff.role_granted' else 'staff.role_revoked' end,
                       'profile', p_user::text, jsonb_build_object('role', p_role));
end $$;

-- ---------------------------------------------------------------------------
-- Event lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.publish_event(p_event uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_event_staff(p_event); e events;
begin
  select * into e from events where id = p_event for update;
  if e.status not in ('draft','postponed') then raise exception 'Only draft or postponed events can be published'; end if;
  if e.starts_at <= now() then raise exception 'The event start time is in the past'; end if;
  if e.price_cents > 0 and not (e.payment_methods && array['online','cash']::payment_method[]) then
    raise exception 'Paid events need at least one payment method (online or cash)';
  end if;
  update events set status = 'published', published_at = coalesce(published_at, now()), status_note = null where id = p_event;
  if e.status = 'postponed' then
    perform public.notify(a.user_id, 'event_changed', e.title || ' is back on',
      'The event has been rescheduled. Please check the updated date and time.', '/activities/' || e.slug, e.id)
    from applications a where a.event_id = p_event
      and a.status in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted');
  end if;
  perform public.audit('event.published', 'event', p_event::text, '{}');
end $$;

create or replace function public.postpone_event(p_event uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_event_staff(p_event); e events;
begin
  select * into e from events where id = p_event for update;
  if e.status <> 'published' then raise exception 'Only published events can be postponed'; end if;
  update events set status = 'postponed', status_note = p_note where id = p_event;
  perform public.notify(a.user_id, 'event_changed', e.title || ' has been postponed',
    coalesce(p_note, 'A new date will be announced. Your application stays active.'), '/activities/' || e.slug, e.id)
  from applications a where a.event_id = p_event
    and a.status in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted');
  perform public.audit('event.postponed', 'event', p_event::text, jsonb_build_object('note', p_note));
end $$;

-- Cancelling an event never penalises members (attendance = event_cancelled).
create or replace function public.cancel_event(p_event uuid, p_note text, p_weather boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_event_staff(p_event); e events;
begin
  select * into e from events where id = p_event for update;
  if e.status in ('cancelled','completed') then raise exception 'Event is already %', e.status; end if;
  update events set status = 'cancelled', cancelled_at = now(), status_note = p_note,
                    weather_cancellation = p_weather, registration_open = false
  where id = p_event;

  perform public.notify(a.user_id, case when p_weather then 'weather_cancellation' else 'event_cancelled' end,
    e.title || case when p_weather then ' is cancelled due to weather' else ' has been cancelled' end,
    coalesce(p_note, 'We are sorry for the change of plans.')
      || case when exists (select 1 from payments p where p.application_id = a.id and p.status = 'paid')
              then ' Any payment you made will be refunded according to the cancellation policy.' else '' end,
    '/dashboard/activities', e.id)
  from applications a where a.event_id = p_event
    and a.status in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted');

  update applications set status = 'cancelled', cancelled_at = now(),
         attendance = case when status in ('approved','awaiting_confirmation','confirmed') then 'event_cancelled'::attendance_outcome else attendance end,
         cancellation_reason = 'Event cancelled by organizers'
  where event_id = p_event
    and status in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted');
  perform public.audit('event.cancelled', 'event', p_event::text, jsonb_build_object('note', p_note, 'weather', p_weather));
end $$;

create or replace function public.complete_event(p_event uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_event_staff(p_event);
begin
  update events set status = 'completed', registration_open = false where id = p_event and status in ('published','postponed');
  if not found then raise exception 'Only published events can be completed'; end if;
  perform public.audit('event.completed', 'event', p_event::text, '{}');
end $$;

create or replace function public.set_registration_open(p_event uuid, p_open boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_event_staff(p_event); e events;
begin
  update events set registration_open = p_open where id = p_event returning * into e;
  if p_open then
    -- Let waitlisted members know registration reopened (only if spaces exist).
    if public.event_spots_left(p_event) > 0 then
      perform public.notify(a.user_id, 'spot_available', 'Spaces opened up: ' || e.title,
        'Registration has reopened and spaces are available. Organizers will review the waitlist first.',
        '/activities/' || e.slug, e.id)
      from applications a where a.event_id = p_event and a.status = 'waitlisted';
    end if;
  end if;
  perform public.audit(case when p_open then 'event.registration_reopened' else 'event.registration_closed' end,
                       'event', p_event::text, '{}');
end $$;

create or replace function public.duplicate_event(p_event uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); v_new uuid := gen_random_uuid(); e events;
begin
  select * into e from events where id = p_event;
  if e.id is null then raise exception 'Event not found'; end if;
  e.id := v_new;
  e.slug := left(e.slug, 60) || '-copy-' || substr(replace(v_new::text, '-', ''), 1, 6);
  e.title := e.title || ' (copy)';
  e.status := 'draft'; e.published_at := null; e.cancelled_at := null; e.status_note := null;
  e.weather_cancellation := false; e.featured := false; e.registration_open := true;
  e.created_by := v_actor; e.created_at := now(); e.updated_at := now(); e.source_suggestion_id := null;
  insert into events select (e).*;
  insert into event_private_details(event_id, meeting_location, meeting_location_url, meeting_time_note,
         parking_information, carpool_details, additional_instructions, organizer_phone_note)
  select v_new, meeting_location, meeting_location_url, meeting_time_note, parking_information,
         carpool_details, additional_instructions, organizer_phone_note
  from event_private_details where event_id = p_event;
  insert into event_organizers(event_id, user_id, is_lead) select v_new, user_id, is_lead from event_organizers where event_id = p_event;
  insert into event_waivers(event_id, template_id) select v_new, template_id from event_waivers where event_id = p_event;
  perform public.audit('event.duplicated', 'event', v_new::text, jsonb_build_object('from', p_event));
  return v_new;
end $$;

-- Only drafts, or events that never received applications, can be deleted.
create or replace function public.delete_event(p_event uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); e events;
begin
  select * into e from events where id = p_event for update;
  if e.id is null then raise exception 'Event not found'; end if;
  if exists (select 1 from applications where event_id = p_event) then
    raise exception 'This event has applications. Cancel it instead so records are preserved.';
  end if;
  delete from events where id = p_event;
  perform public.audit('event.deleted', 'event', p_event::text, jsonb_build_object('title', e.title));
end $$;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create or replace function public.apply_to_event(
  p_event uuid, p_answers jsonb default '{}', p_equipment text[] default '{}', p_note text default null,
  p_experience text default null, p_wants_carpool boolean default null, p_can_drive_seats int default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := public.require_auth(); v_status member_status; e events; v_app applications; q jsonb; v_id uuid;
begin
  select status into v_status from profiles where id = v_user and deleted_at is null;
  if v_status is distinct from 'active' then
    raise exception using errcode = '42501', message = case v_status
      when 'pending' then 'Your membership is still awaiting approval'
      when 'restricted' then 'Your booking privileges are restricted. You can submit an explanation from your account standing page.'
      when 'suspended' then 'Your membership is suspended'
      else 'Your account cannot apply for activities' end;
  end if;

  select * into e from events where id = p_event;
  if e.id is null or e.status <> 'published' then raise exception 'This event is not accepting applications'; end if;
  if not e.registration_open then raise exception 'Registration for this event is closed'; end if;
  if e.registration_opens_at is not null and e.registration_opens_at > now() then raise exception 'Registration has not opened yet'; end if;
  if e.registration_deadline is not null and e.registration_deadline < now() then raise exception 'The registration deadline has passed'; end if;
  if e.starts_at <= now() then raise exception 'This event has already started'; end if;
  if public.event_spots_left(p_event) = 0 and not e.waitlist_enabled then
    raise exception 'This event is full and has no waitlist';
  end if;

  for q in select * from jsonb_array_elements(e.application_questions) loop
    if coalesce((q ->> 'required')::boolean, false)
       and coalesce(btrim(p_answers ->> (q ->> 'id')), '') = '' then
      raise exception 'Please answer: %', q ->> 'label' using errcode = '23502';
    end if;
  end loop;

  select * into v_app from applications where event_id = p_event and user_id = v_user for update;
  if v_app.id is not null then
    if v_app.status = 'cancelled' and v_app.attendance is null then
      update applications set status = 'submitted', answers = coalesce(p_answers, '{}'), equipment_confirmed = coalesce(p_equipment, '{}'),
             note_to_organizer = p_note, experience_statement = p_experience, wants_carpool = p_wants_carpool,
             can_drive_seats = p_can_drive_seats, cancelled_at = null, cancellation_reason = null,
             decided_at = null, decided_by = null, decision_message = null, created_at = now()
      where id = v_app.id;
      v_id := v_app.id;
    else
      raise exception 'You have already applied for this event' using errcode = '23505';
    end if;
  else
    insert into applications(event_id, user_id, answers, equipment_confirmed, note_to_organizer,
                             experience_statement, wants_carpool, can_drive_seats)
    values (p_event, v_user, coalesce(p_answers, '{}'), coalesce(p_equipment, '{}'), p_note, p_experience,
            p_wants_carpool, p_can_drive_seats)
    returning id into v_id;
  end if;

  perform public.notify(v_user, 'application_submitted', 'Application received: ' || e.title,
    'Thanks for applying. Organizers review applications based on the published selection criteria. Applying does not guarantee a place — we will update you either way.',
    '/dashboard/activities', e.id);
  return v_id;
end $$;

-- Staff review actions, individually or in batches.
-- p_action: under_review | approve | waitlist | not_selected | remove
create or replace function public.review_applications(p_ids uuid[], p_action text, p_message text default null,
                                                     p_confirm_by timestamptz default null)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_auth(); v_event uuid; e events; a applications; v_free int; v_n int := 0;
  v_holding boolean;
begin
  select distinct event_id into v_event from applications where id = any(p_ids);
  if v_event is null then raise exception 'No applications selected'; end if;
  if (select count(distinct event_id) from applications where id = any(p_ids)) > 1 then
    raise exception 'Batch actions must target a single event';
  end if;
  perform public.require_event_staff(v_event);
  select * into e from events where id = v_event;

  if p_action = 'approve' then
    v_free := public.lock_event_capacity(v_event);
    if v_free < (select count(*) from applications where id = any(p_ids)
                 and status in ('submitted','under_review','waitlisted','not_selected')) then
      raise exception 'Not enough spaces: % available. Increase capacity, release reserved spots, or approve fewer applicants.', greatest(v_free, 0)
        using errcode = '23514';
    end if;
  end if;

  for a in select * from applications where id = any(p_ids) for update loop
    v_holding := a.status in ('approved','awaiting_confirmation','confirmed');
    if p_action = 'under_review' and a.status = 'submitted' then
      update applications set status = 'under_review' where id = a.id;
    elsif p_action = 'approve' and a.status in ('submitted','under_review','waitlisted','not_selected') then
      update applications set status = 'approved', waitlist_position = null, decided_by = v_actor, decided_at = now(),
             decision_message = p_message, confirm_by = coalesce(p_confirm_by, public.default_confirm_by(v_event))
      where id = a.id;
      perform public.notify(a.user_id, 'application_approved', 'You''re in: ' || e.title,
        coalesce(p_message || E'\n\n', '') || 'Please sign any required waivers, complete payment if applicable, and confirm your attendance'
        || coalesce(' by ' || to_char((coalesce(p_confirm_by, public.default_confirm_by(v_event))) at time zone e.time_zone, 'Dy Mon DD, HH12:MI AM'), '') || '.',
        '/dashboard/activities', e.id);
    elsif p_action = 'waitlist' and a.status in ('submitted','under_review','not_selected') then
      update applications set status = 'waitlisted', decided_by = v_actor, decided_at = now(), decision_message = p_message,
             waitlist_position = coalesce((select max(waitlist_position) from applications where event_id = v_event), 0) + 1
      where id = a.id;
      perform public.notify(a.user_id, 'waitlisted', 'You''re on the waitlist: ' || e.title,
        coalesce(p_message || E'\n\n', '') || 'If a space opens up we will send you an offer with a deadline to accept.',
        '/dashboard/activities', e.id);
    elsif p_action = 'not_selected' and a.status in ('submitted','under_review','waitlisted') then
      update applications set status = 'not_selected', waitlist_position = null, decided_by = v_actor,
             decided_at = now(), decision_message = p_message where id = a.id;
      perform public.notify(a.user_id, 'application_not_selected', 'Update on ' || e.title,
        coalesce(p_message, 'Thank you for applying. We weren''t able to offer you a place this time. Selection considers group balance, experience and fair rotation, so please keep applying.'),
        '/dashboard/activities', e.id);
    elsif p_action = 'remove' and a.status in ('approved','awaiting_confirmation','confirmed','waitlisted','submitted','under_review') then
      update applications set status = 'cancelled', cancelled_at = now(), waitlist_position = null,
             cancellation_reason = 'Removed by organizer', decision_message = p_message, decided_by = v_actor, decided_at = now()
      where id = a.id;
      perform public.notify(a.user_id, 'application_removed', 'Your place for ' || e.title || ' was released',
        coalesce(p_message, 'An organizer has released your place for this event. Contact the community team if you have questions.'),
        '/dashboard/activities', e.id);
      if v_holding then perform public.handle_spot_released(v_event, a.id); end if;
    else
      continue;
    end if;
    v_n := v_n + 1;
    perform public.audit('application.' || p_action, 'application', a.id::text, jsonb_build_object('event', v_event));
  end loop;
  return v_n;
end $$;

-- Invite a specific member. May use reserved spaces.
create or replace function public.invite_member(p_event uuid, p_user uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_event_staff(p_event); e events; v_free int; v_res_free int; v_id uuid;
begin
  if (select status from profiles where id = p_user) <> 'active' then raise exception 'Only active members can be invited'; end if;
  v_free := public.lock_event_capacity(p_event, false);
  select * into e from events where id = p_event;
  if v_free <= 0 then
    v_res_free := public.lock_event_capacity(p_event, true);
    if v_res_free <= 0 then raise exception 'The event is at capacity' using errcode = '23514'; end if;
    update events set reserved_spots = reserved_spots - 1 where id = p_event;  -- use a reserved space
  end if;
  insert into applications(event_id, user_id, status, invited, offer_expires_at, decided_by, decided_at, decision_message)
  values (p_event, p_user, 'awaiting_confirmation', true, now() + make_interval(hours => e.waitlist_offer_hours),
          v_actor, now(), p_message)
  on conflict (event_id, user_id) do update
    set status = 'awaiting_confirmation', invited = true, offer_expires_at = excluded.offer_expires_at,
        decided_by = v_actor, decided_at = now(), decision_message = p_message, waitlist_position = null
    where applications.status not in ('approved','confirmed','attended','no_show','awaiting_confirmation')
  returning id into v_id;
  if v_id is null then raise exception 'This member already has a place'; end if;
  perform public.notify(p_user, 'invitation', 'You''re invited: ' || e.title,
    coalesce(p_message || E'\n\n', '') || 'Accept within ' || e.waitlist_offer_hours || ' hours to claim your place.',
    '/dashboard/activities', e.id);
  perform public.audit('application.invited', 'application', v_id::text, jsonb_build_object('event', p_event, 'user', p_user));
  return v_id;
end $$;

-- Offer a waitlisted member a space (manual promotion).
create or replace function public.offer_spot(p_application uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications; e events;
begin
  select * into a from applications where id = p_application;
  if a.id is null then raise exception 'Application not found'; end if;
  perform public.require_event_staff(a.event_id);
  perform public.make_offer(a.id);
end $$;

-- Internal: convert a waitlisted application into a time-limited offer.
create or replace function public.make_offer(p_application uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications; e events;
begin
  select * into a from applications where id = p_application for update;
  if a.status <> 'waitlisted' then raise exception 'Only waitlisted applicants can receive an offer'; end if;
  if public.lock_event_capacity(a.event_id) <= 0 then raise exception 'No space is available' using errcode = '23514'; end if;
  select * into e from events where id = a.event_id;
  update applications set status = 'awaiting_confirmation',
         offer_expires_at = least(now() + make_interval(hours => e.waitlist_offer_hours), e.starts_at - interval '1 hour')
  where id = a.id;
  perform public.notify(a.user_id, 'spot_available', 'A space opened up: ' || e.title,
    'You have until ' || to_char(least(now() + make_interval(hours => e.waitlist_offer_hours), e.starts_at - interval '1 hour') at time zone e.time_zone, 'Dy Mon DD, HH12:MI AM')
    || ' to accept this place.', '/dashboard/activities', e.id);
  perform public.audit('application.offered', 'application', a.id::text, jsonb_build_object('event', a.event_id));
  return true;
end $$;

-- Internal: called whenever a held space is released.
create or replace function public.handle_spot_released(p_event uuid, p_released_app uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare e events; v_next uuid;
begin
  select * into e from events where id = p_event;
  if e.status not in ('published','postponed') or e.starts_at <= now() then return; end if;
  perform public.notify_event_staff(p_event, 'participant_cancelled', 'A place opened up: ' || e.title,
    case when e.waitlist_mode = 'automatic' then 'The next person on the waitlist has been offered the space automatically.'
         else 'Review the waitlist to choose a replacement.' end,
    '/admin/events/' || p_event || '/applications');
  if e.waitlist_mode = 'automatic' then
    select id into v_next from applications where event_id = p_event and status = 'waitlisted'
    order by waitlist_position nulls last, created_at limit 1;
    if v_next is not null and public.event_spots_left(p_event) > 0 then
      perform public.make_offer(v_next);
    end if;
  end if;
end $$;

-- Member accepts or declines an offer / invitation.
create or replace function public.respond_to_offer(p_application uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth(); a applications; e events;
begin
  select * into a from applications where id = p_application and user_id = v_user for update;
  if a.id is null or a.status <> 'awaiting_confirmation' then raise exception 'There is no open offer for this application'; end if;
  if a.offer_expires_at is not null and a.offer_expires_at < now() then raise exception 'This offer has expired'; end if;
  select * into e from events where id = a.event_id;
  if p_accept then
    if public.my_status() <> 'active' then raise exception 'Your account cannot accept places right now' using errcode = '42501'; end if;
    update applications set status = 'approved', offer_expires_at = null,
           confirm_by = public.default_confirm_by(a.event_id), decided_at = now() where id = a.id;
    perform public.notify(v_user, 'application_approved', 'Place accepted: ' || e.title,
      'Next steps: sign any required waivers, complete payment if applicable, then confirm your attendance.',
      '/dashboard/activities', e.id);
  else
    update applications set status = 'cancelled', offer_expires_at = null, cancelled_at = now(),
           cancellation_reason = 'Offer declined' where id = a.id;
    perform public.handle_spot_released(a.event_id, a.id);
  end if;
  perform public.audit(case when p_accept then 'application.offer_accepted' else 'application.offer_declined' end,
                       'application', a.id::text, '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Waivers
-- ---------------------------------------------------------------------------
create or replace function public.publish_waiver_version(p_template uuid, p_body text, p_summary text,
                                                         p_requires_resign boolean default true)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); v_ver int;
begin
  update waiver_templates set current_version = current_version + 1, legal_reviewed = false, legal_reviewed_at = null
  where id = p_template returning current_version into v_ver;
  if v_ver is null then raise exception 'Waiver template not found'; end if;
  insert into waiver_versions(template_id, version, body, change_summary, requires_resign, created_by)
  values (p_template, v_ver, p_body, p_summary, case when v_ver = 1 then true else p_requires_resign end, v_actor);
  perform public.audit('waiver.version_published', 'waiver_template', p_template::text,
                       jsonb_build_object('version', v_ver, 'requires_resign', p_requires_resign));
  return v_ver;
end $$;

create or replace function public.waiver_min_valid_version(p_template uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(max(version) filter (where requires_resign), 1) from waiver_versions where template_id = p_template;
$$;

create or replace function public.has_valid_waiver(p_user uuid, p_template uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from waiver_signatures s
                 where s.user_id = p_user and s.template_id = p_template
                   and s.version >= public.waiver_min_valid_version(p_template));
$$;

-- Templates required for an event: attached waivers + the general community waiver.
create or replace function public.event_required_waivers(p_event uuid)
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select template_id from event_waivers ew join waiver_templates t on t.id = ew.template_id
  where ew.event_id = p_event and t.active and t.current_version > 0
  union
  select t.id from waiver_templates t
  where t.id = nullif(public.setting('general_waiver_template_id') #>> '{}', '')::uuid
    and t.active and t.current_version > 0;
$$;

create or replace function public.missing_waivers(p_event uuid, p_user uuid default auth.uid())
returns table(template_id uuid, title text, version int)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, t.title, t.current_version
  from waiver_templates t
  where t.id in (select public.event_required_waivers(p_event))
    and not public.has_valid_waiver(p_user, t.id)
    -- callers: the member themself, event staff, or trusted server contexts (service role / cron: no JWT)
    and (auth.uid() is null or p_user = auth.uid() or public.is_event_staff(p_event));
$$;

create or replace function public.sign_waiver(p_template uuid, p_signature_name text, p_event uuid default null,
                                             p_ip text default null, p_user_agent text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth(); v waiver_versions; v_first text; v_last text; v_id uuid; v_app uuid;
begin
  select p.first_name, mp.last_name into v_first, v_last
  from profiles p join member_private mp on mp.user_id = p.id where p.id = v_user;
  if lower(regexp_replace(btrim(p_signature_name), '\s+', ' ', 'g')) <> lower(btrim(v_first) || ' ' || btrim(v_last)) then
    raise exception 'Please type your full name exactly as it appears on your account (% %)', v_first, v_last
      using errcode = '22023';
  end if;
  select wv.* into v from waiver_versions wv join waiver_templates t on t.id = wv.template_id
  where wv.template_id = p_template and wv.version = t.current_version and t.active;
  if v.id is null then raise exception 'Waiver not available'; end if;
  if p_event is not null then
    select id into v_app from applications where event_id = p_event and user_id = v_user;
  end if;
  insert into waiver_signatures(user_id, template_id, version_id, version, event_id, application_id,
                                signature_name, signer_display, body_sha256, ip_address, user_agent)
  values (v_user, p_template, v.id, v.version, p_event, v_app, btrim(p_signature_name),
          v_first || ' ' || v_last, encode(digest(v.body, 'sha256'), 'hex'),
          nullif(p_ip, '')::inet, left(p_user_agent, 500))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create or replace function public.next_receipt_number()
returns text language sql security definer set search_path = public, pg_temp as $$
  select 'RC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('receipt_seq')::text, 6, '0');
$$;

-- Amount due for an application (fee or deposit) in cents.
create or replace function public.amount_due(p_application uuid, p_kind public.payment_kind default 'fee')
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_kind = 'deposit' then e.deposit_cents else e.price_cents end
  from applications a join events e on e.id = a.event_id where a.id = p_application;
$$;

create or replace function public.has_paid(p_application uuid, p_kind public.payment_kind default 'fee')
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from payments where application_id = p_application and kind = p_kind
                 and status in ('paid','waived'));
$$;

-- Called by the server action before redirecting to Stripe Checkout.
-- Members are never charged before approval.
create or replace function public.register_checkout_session(p_application uuid, p_kind public.payment_kind, p_session_id text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth(); a applications; e events; v_id uuid; v_amount int;
begin
  select * into a from applications where id = p_application and user_id = v_user;
  if a.id is null then raise exception 'Application not found'; end if;
  if a.status not in ('approved','confirmed') then
    raise exception 'Payment is only requested after your application is approved' using errcode = '42501';
  end if;
  select * into e from events where id = a.event_id;
  if not ('online' = any(e.payment_methods)) then raise exception 'Online payment is not offered for this event'; end if;
  if public.has_paid(a.id, p_kind) then raise exception 'This has already been paid'; end if;
  v_amount := public.amount_due(a.id, p_kind);
  if v_amount <= 0 then raise exception 'Nothing to pay'; end if;
  -- Replace any abandoned pending online attempt.
  update payments set status = 'failed', notes = 'Superseded by a new checkout session'
  where application_id = a.id and kind = p_kind and method = 'online' and status = 'pending';
  insert into payments(application_id, event_id, user_id, kind, method, status, amount_cents, currency, stripe_checkout_session_id)
  values (a.id, a.event_id, v_user, p_kind, 'online', 'pending', v_amount, e.currency, p_session_id)
  returning id into v_id;
  return v_id;
end $$;

-- Stripe webhook (service role only).
create or replace function public.record_online_payment(p_session_id text, p_payment_intent text, p_amount_cents int)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p payments; e events;
begin
  select * into p from payments where stripe_checkout_session_id = p_session_id for update;
  if p.id is null then raise exception 'Unknown checkout session %', p_session_id; end if;
  if p.status = 'paid' then return p.id; end if;   -- idempotent
  if p_amount_cents < p.amount_cents then raise exception 'Amount mismatch for %', p_session_id; end if;
  update payments set status = 'paid', stripe_payment_intent_id = p_payment_intent, paid_at = now(),
         receipt_number = public.next_receipt_number()
  where id = p.id;
  select * into e from events where id = p.event_id;
  perform public.notify(p.user_id, 'payment_received', 'Payment received: ' || e.title,
    'We received ' || to_char(p.amount_cents / 100.0, 'FM$999,990.00') || ' ' || p.currency
    || '. Your receipt is available in your payments page.', '/dashboard/payments', e.id);
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (null, 'payment.online_received', 'payment', p.id::text, jsonb_build_object('session', p_session_id));
  return p.id;
end $$;

create or replace function public.mark_checkout_expired(p_session_id text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update payments set status = 'failed', notes = 'Checkout session expired'
  where stripe_checkout_session_id = p_session_id and status = 'pending';
$$;

create or replace function public.record_cash_payment(p_application uuid, p_amount_cents int, p_notes text default null,
                                                     p_kind public.payment_kind default 'fee')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_auth(); a applications; e events; v_id uuid;
begin
  select * into a from applications where id = p_application;
  if a.id is null then raise exception 'Application not found'; end if;
  perform public.require_event_staff(a.event_id);
  select * into e from events where id = a.event_id;
  if p_amount_cents <= 0 then raise exception 'Amount must be positive'; end if;
  -- Close an outstanding cash placeholder if one exists, else create a new record.
  update payments set status = 'paid', amount_cents = p_amount_cents, paid_at = now(), recorded_by = v_actor,
         receipt_number = public.next_receipt_number(), notes = p_notes
  where id = (select id from payments where application_id = a.id and kind = p_kind and method = 'cash'
              and status = 'pending' limit 1)
  returning id into v_id;
  if v_id is null then
    insert into payments(application_id, event_id, user_id, kind, method, status, amount_cents, currency,
                         paid_at, recorded_by, receipt_number, notes)
    values (a.id, a.event_id, a.user_id, p_kind, 'cash', 'paid', p_amount_cents, e.currency, now(), v_actor,
            public.next_receipt_number(), p_notes)
    returning id into v_id;
  end if;
  perform public.notify(a.user_id, 'payment_received', 'Cash payment recorded: ' || e.title,
    'An organizer recorded your cash payment of ' || to_char(p_amount_cents / 100.0, 'FM$999,990.00') || '.',
    '/dashboard/payments', e.id);
  perform public.audit('payment.cash_recorded', 'payment', v_id::text, jsonb_build_object('amount_cents', p_amount_cents));
  return v_id;
end $$;

create or replace function public.waive_payment(p_application uuid, p_reason text, p_kind public.payment_kind default 'fee')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); a applications; v_id uuid;
begin
  select * into a from applications where id = p_application;
  insert into payments(application_id, event_id, user_id, kind, method, status, amount_cents, recorded_by, notes)
  values (a.id, a.event_id, a.user_id, p_kind, 'none', 'waived', 0, v_actor, p_reason) returning id into v_id;
  perform public.audit('payment.waived', 'payment', v_id::text, jsonb_build_object('reason', p_reason));
  return v_id;
end $$;

-- Record a refund. For online payments the server action issues the Stripe refund first.
create or replace function public.record_refund(p_payment uuid, p_amount_cents int, p_reason text,
                                               p_stripe_refund_id text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); p payments; v_id uuid; e events;
begin
  -- Service role (Stripe webhook) has no auth.uid(); otherwise an admin is required.
  if v_actor is not null then perform public.require_admin(); end if;
  select * into p from payments where id = p_payment for update;
  if p.id is null or p.status not in ('paid','partially_refunded') then raise exception 'Only paid payments can be refunded'; end if;
  if p_stripe_refund_id is not null and exists (select 1 from refunds where stripe_refund_id = p_stripe_refund_id) then
    return (select id from refunds where stripe_refund_id = p_stripe_refund_id);
  end if;
  if p_amount_cents > p.amount_cents - p.refunded_cents then raise exception 'Refund exceeds the remaining paid amount'; end if;
  insert into refunds(payment_id, amount_cents, reason, method, stripe_refund_id, processed_by)
  values (p.id, p_amount_cents, p_reason, p.method, p_stripe_refund_id, v_actor) returning id into v_id;
  update payments set refunded_cents = refunded_cents + p_amount_cents,
         status = case when refunded_cents + p_amount_cents >= amount_cents then 'refunded'::payment_status
                       else 'partially_refunded'::payment_status end
  where id = p.id;
  select * into e from events where id = p.event_id;
  perform public.notify(p.user_id, 'refund_issued', 'Refund issued: ' || e.title,
    to_char(p_amount_cents / 100.0, 'FM$999,990.00') || ' has been refunded'
    || case when p.method = 'online' then ' to your original payment method (allow 5–10 business days).' else '.' end,
    '/dashboard/payments', e.id);
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (v_actor, 'payment.refunded', 'payment', p.id::text, jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Confirmation (server-side gate: waivers + payment)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_participation(p_application uuid, p_payment_choice public.payment_method default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth(); a applications; e events; v_missing text; v_choice payment_method;
begin
  select * into a from applications where id = p_application and user_id = v_user for update;
  if a.id is null then raise exception 'Application not found'; end if;
  if a.status <> 'approved' then raise exception 'Only approved applications can be confirmed'; end if;
  if a.confirm_by is not null and a.confirm_by < now() then raise exception 'The confirmation deadline has passed'; end if;
  if public.my_status() <> 'active' then raise exception 'Your account cannot confirm places right now' using errcode = '42501'; end if;
  select * into e from events where id = a.event_id;
  if e.status <> 'published' then raise exception 'This event is not currently running'; end if;

  select string_agg(title, ', ') into v_missing from public.missing_waivers(a.event_id, v_user);
  if v_missing is not null then
    raise exception 'Please sign the required waiver(s) first: %', v_missing using errcode = 'P0001', hint = 'waiver_required';
  end if;

  if e.deposit_cents > 0 and not public.has_paid(a.id, 'deposit') then
    raise exception 'A deposit is required to confirm your place' using errcode = 'P0001', hint = 'payment_required';
  end if;

  if e.price_cents > 0 then
    if public.has_paid(a.id, 'fee') then
      v_choice := coalesce((select method from payments where application_id = a.id and kind = 'fee'
                            and status in ('paid','waived') order by created_at desc limit 1), 'online');
    elsif p_payment_choice = 'cash' and 'cash' = any(e.payment_methods) then
      v_choice := 'cash';
      if not exists (select 1 from payments where application_id = a.id and kind = 'fee' and method = 'cash' and status = 'pending') then
        insert into payments(application_id, event_id, user_id, kind, method, status, amount_cents, currency, notes)
        values (a.id, a.event_id, v_user, 'fee', 'cash', 'pending', e.price_cents, e.currency, 'To be paid in cash');
      end if;
    else
      raise exception 'Payment is required to confirm your place' using errcode = 'P0001', hint = 'payment_required';
    end if;
  else
    v_choice := 'none';
  end if;

  update applications set status = 'confirmed', confirmed_at = now(), payment_choice = v_choice where id = a.id;
  perform public.notify(v_user, 'attendance_confirmed', 'Confirmed: ' || e.title,
    'You''re confirmed. Meeting details and the participant page are now available.' ||
    case when v_choice = 'cash' then ' Please bring ' || to_char(e.price_cents / 100.0, 'FM$999,990.00') || ' in cash.' else '' end,
    '/activities/' || e.slug || '/hub', e.id);
  perform public.audit('application.confirmed', 'application', a.id::text, '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Member cancellation
-- ---------------------------------------------------------------------------
create or replace function public.cancel_my_application(p_application uuid, p_reason text default null,
                                                       p_safety_or_emergency boolean default false)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth(); a applications; e events; v_deadline timestamptz;
        v_outcome attendance_outcome; v_holding boolean;
begin
  select * into a from applications where id = p_application and user_id = v_user for update;
  if a.id is null then raise exception 'Application not found'; end if;
  if a.status not in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted') then
    raise exception 'This application can no longer be cancelled';
  end if;
  select * into e from events where id = a.event_id;
  if e.starts_at <= now() then raise exception 'The event has started; please contact your organizer'; end if;
  v_holding := a.status in ('approved','awaiting_confirmation','confirmed');
  v_deadline := coalesce(e.cancellation_deadline,
                         e.starts_at - make_interval(hours => coalesce((public.setting('default_cancellation_hours') #>> '{}')::int, 48)));
  if v_holding then
    -- Safety/emergency withdrawals are recorded as excused: no penalty.
    v_outcome := case when p_safety_or_emergency then 'excused_absence'
                      when now() <= v_deadline then 'cancelled_in_period'
                      else 'late_cancellation' end;
  end if;
  update applications set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason,
         attendance = v_outcome, waitlist_position = null, offer_expires_at = null
  where id = a.id;
  if v_holding then perform public.handle_spot_released(a.event_id, a.id); end if;
  perform public.audit('application.cancelled_by_member', 'application', a.id::text,
                       jsonb_build_object('outcome', v_outcome, 'safety_or_emergency', p_safety_or_emergency));
  return coalesce(v_outcome::text, 'withdrawn');
end $$;

-- ---------------------------------------------------------------------------
-- Attendance, no-shows, appeals
-- ---------------------------------------------------------------------------
create or replace function public.record_attendance(p_application uuid, p_outcome public.attendance_outcome,
                                                   p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_auth(); a applications;
begin
  select * into a from applications where id = p_application for update;
  if a.id is null then raise exception 'Application not found'; end if;
  perform public.require_event_staff(a.event_id);
  if a.status not in ('confirmed','approved','attended','no_show','cancelled') then
    raise exception 'Attendance can only be recorded for selected participants';
  end if;
  if p_outcome = 'event_cancelled' then raise exception 'Use Cancel event instead'; end if;
  update applications set attendance = p_outcome, attendance_recorded_by = v_actor, attendance_recorded_at = now(),
         status = case p_outcome when 'attended' then 'attended'::application_status
                                 when 'unexcused_no_show' then 'no_show'::application_status
                                 else 'cancelled'::application_status end,
         checked_in_at = case when p_outcome = 'attended' then coalesce(checked_in_at, now()) else checked_in_at end,
         -- An administrator recording a no-show confirms it immediately; organizer entries await admin confirmation.
         no_show_confirmed = case when p_outcome = 'unexcused_no_show' then public.is_admin(v_actor) else false end
  where id = a.id;
  if p_note is not null and btrim(p_note) <> '' then
    insert into admin_notes(user_id, event_id, body, author_id) values (a.user_id, a.event_id, p_note, v_actor);
  end if;
  perform public.audit('attendance.recorded', 'application', a.id::text, jsonb_build_object('outcome', p_outcome));
end $$;

create or replace function public.confirm_no_show(p_application uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin();
begin
  update applications set no_show_confirmed = true where id = p_application and attendance = 'unexcused_no_show';
  if not found then raise exception 'No unexcused no-show recorded for this application'; end if;
  perform public.audit('attendance.no_show_confirmed', 'application', p_application::text, '{}');
end $$;

-- Automatic restriction once an administrator confirms an unexcused no-show.
create or replace function public.apply_no_show_restriction() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare e events;
begin
  if new.no_show_confirmed and not coalesce(old.no_show_confirmed, false) and new.attendance = 'unexcused_no_show' then
    select * into e from events where id = new.event_id;
    update profiles set status = 'restricted', status_changed_at = now(),
           status_reason = 'Unexcused no-show: ' || e.title
    where id = new.user_id and status = 'active';
    if found then
      perform public.notify(new.user_id, 'no_show_restriction', 'Your booking privileges are paused',
        'Our records show you did not attend ' || e.title || ' without cancelling. Under the attendance policy, '
        || 'applying for new activities is paused. If something unexpected happened, please submit an explanation — we review every one.',
        '/dashboard/standing', e.id);
      insert into audit_log(actor_id, action, entity, entity_id, details)
      values (auth.uid(), 'member.auto_restricted', 'profile', new.user_id::text, jsonb_build_object('application', new.id));
    end if;
  end if;
  return new;
end $$;
create trigger applications_no_show after update of no_show_confirmed on public.applications
  for each row execute function public.apply_no_show_restriction();

create or replace function public.submit_appeal(p_explanation text, p_application uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth(); v_id uuid;
begin
  if public.my_status() not in ('restricted','suspended') then
    raise exception 'Appeals are available when your account is restricted or suspended';
  end if;
  if exists (select 1 from appeals where user_id = v_user and status in ('submitted','under_review')) then
    raise exception 'You already have an appeal under review';
  end if;
  if char_length(btrim(p_explanation)) < 20 then raise exception 'Please include a little more detail (20+ characters)'; end if;
  insert into appeals(user_id, application_id, explanation) values (v_user, p_application, btrim(p_explanation))
  returning id into v_id;
  perform public.notify(s.user_id, 'appeal_submitted', 'New appeal to review', 'A member submitted an explanation.',
                        '/admin/appeals') from staff_roles s where s.role in ('owner','admin');
  return v_id;
end $$;

create or replace function public.decide_appeal(p_appeal uuid, p_approve boolean, p_message text, p_restore boolean default true)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); ap appeals;
begin
  select * into ap from appeals where id = p_appeal for update;
  if ap.id is null or ap.status not in ('submitted','under_review') then raise exception 'Appeal is not open'; end if;
  update appeals set status = case when p_approve then 'approved'::appeal_status else 'rejected'::appeal_status end,
         decision_message = p_message, decided_by = v_actor, decided_at = now()
  where id = ap.id;
  if p_approve and p_restore then
    update profiles set status = 'active', status_reason = null, restricted_until = null, status_changed_at = now()
    where id = ap.user_id and status in ('restricted','suspended');
    -- Treat the related no-show as excused so it doesn't count against reliability.
    if ap.application_id is not null then
      update applications set attendance = 'excused_absence', status = 'cancelled' where id = ap.application_id and attendance = 'unexcused_no_show';
    end if;
  end if;
  perform public.notify(ap.user_id, 'appeal_decision',
    case when p_approve then 'Your appeal was accepted' else 'Decision on your appeal' end,
    coalesce(p_message, case when p_approve then 'Your booking privileges have been restored.' else 'Your restriction remains in place.' end),
    '/dashboard/standing');
  perform public.audit('appeal.decided', 'appeal', ap.id::text, jsonb_build_object('approved', p_approve));
end $$;

-- ---------------------------------------------------------------------------
-- Event day: check-in, safe departure, emergency contacts
-- ---------------------------------------------------------------------------
create or replace function public.set_check_in(p_application uuid, p_checked boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications;
begin
  select * into a from applications where id = p_application;
  perform public.require_event_staff(a.event_id);
  update applications set checked_in_at = case when p_checked then now() else null end where id = a.id;
end $$;

create or replace function public.mark_departed_safely(p_application uuid, p_departed boolean default true)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a applications;
begin
  select * into a from applications where id = p_application;
  perform public.require_event_staff(a.event_id);
  update applications set departed_safely_at = case when p_departed then now() else null end where id = a.id;
  perform public.audit('event.participant_departed', 'application', a.id::text, jsonb_build_object('departed', p_departed));
end $$;

-- Organizers see emergency contacts only for confirmed participants of their events; every view is audited.
create or replace function public.get_event_emergency_contacts(p_event uuid)
returns table(user_id uuid, member_name text, phone text, emergency_contact_name text,
              emergency_contact_phone text, emergency_contact_relationship text, medical_notes text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_event_staff(p_event);
  perform public.audit('emergency_contacts.viewed', 'event', p_event::text, '{}');
  return query
  select p.id, p.first_name || ' ' || mp.last_name, mp.phone, mp.emergency_contact_name, mp.emergency_contact_phone,
         mp.emergency_contact_relationship, mp.medical_notes
  from applications a join profiles p on p.id = a.user_id join member_private mp on mp.user_id = p.id
  where a.event_id = p_event and a.status in ('confirmed','attended','approved')
  order by p.first_name;
end $$;

-- ---------------------------------------------------------------------------
-- Reliability & stats
-- ---------------------------------------------------------------------------
create or replace function public.member_reliability(p_user uuid)
returns table(applications int, selected int, attended int, no_shows int, late_cancellations int,
              cancelled_in_period int, excused int, attendance_rate numeric, last_attended timestamptz,
              last_selected timestamptz, warnings int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_staff() and p_user <> auth.uid() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select count(*)::int,
         count(*) filter (where a.status in ('approved','awaiting_confirmation','confirmed','attended','no_show') or a.attendance is not null)::int,
         count(*) filter (where a.attendance = 'attended')::int,
         count(*) filter (where a.attendance = 'unexcused_no_show')::int,
         count(*) filter (where a.attendance = 'late_cancellation')::int,
         count(*) filter (where a.attendance = 'cancelled_in_period')::int,
         count(*) filter (where a.attendance = 'excused_absence')::int,
         case when count(*) filter (where a.attendance in ('attended','unexcused_no_show','late_cancellation')) = 0 then null
              else round(100.0 * count(*) filter (where a.attendance = 'attended')
                         / count(*) filter (where a.attendance in ('attended','unexcused_no_show','late_cancellation')), 0) end,
         max(e.starts_at) filter (where a.attendance = 'attended'),
         max(a.decided_at) filter (where a.status in ('approved','confirmed','attended')),
         (select count(*)::int from member_warnings w where w.user_id = p_user)
  from applications a join events e on e.id = a.event_id where a.user_id = p_user;
end $$;

create or replace function public.my_activity_stats()
returns table(completed int, distance_km numeric, elevation_m bigint, upcoming int)
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*) filter (where a.status = 'attended')::int,
         coalesce(sum(e.distance_km) filter (where a.status = 'attended' and c.tracks_distance), 0),
         coalesce(sum(e.elevation_gain_m) filter (where a.status = 'attended' and c.tracks_distance), 0)::bigint,
         count(*) filter (where a.status = 'confirmed' and e.starts_at > now())::int
  from applications a join events e on e.id = a.event_id join activity_categories c on c.id = e.category_id
  where a.user_id = auth.uid();
$$;

create or replace function public.community_stats()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'members', (select count(*) from profiles where status = 'active' and deleted_at is null),
    'events_completed', (select count(*) from events where status = 'completed' or (status = 'published' and coalesce(ends_at, starts_at) < now())),
    'participations', (select count(*) from applications where status = 'attended'),
    'km_travelled', (select coalesce(round(sum(e.distance_km)), 0) from applications a join events e on e.id = a.event_id where a.status = 'attended'),
    'attendance_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where attendance = 'attended') / count(*)) end
                        from applications where attendance in ('attended','unexcused_no_show','late_cancellation'))
  );
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'members_total', (select count(*) from profiles where deleted_at is null),
    'members_active', (select count(*) from profiles where status = 'active' and deleted_at is null),
    'members_pending', (select count(*) from profiles where status = 'pending' and deleted_at is null),
    'members_restricted', (select count(*) from profiles where status = 'restricted'),
    'members_suspended', (select count(*) from profiles where status = 'suspended'),
    'events_upcoming', (select count(*) from events where status in ('published','postponed') and starts_at > now()),
    'events_draft', (select count(*) from events where status = 'draft'),
    'applications_pending', (select count(*) from applications a join events e on e.id = a.event_id
                             where a.status in ('submitted','under_review') and e.starts_at > now()),
    'appeals_open', (select count(*) from appeals where status in ('submitted','under_review')),
    'reports_open', (select count(*) from content_reports where status in ('open','in_review')),
    'suggestions_new', (select count(*) from suggestions where status = 'submitted'),
    'no_shows_unconfirmed', (select count(*) from applications where attendance = 'unexcused_no_show' and not no_show_confirmed),
    'attendance_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where attendance = 'attended') / count(*), 1) end
                        from applications where attendance in ('attended','unexcused_no_show','late_cancellation')),
    'no_show_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where attendance = 'unexcused_no_show') / count(*), 1) end
                     from applications where attendance in ('attended','unexcused_no_show','late_cancellation')),
    'repeat_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where n > 1) / count(*), 1) end
                    from (select user_id, count(*) n from applications where status = 'attended' group by user_id) s),
    'capacity_utilization', (select case when sum(max_participants) = 0 then null
                                         else round(100.0 * sum(public.event_spots_taken(id)) / sum(max_participants), 1) end
                             from events where status in ('published','completed') and starts_at > now() - interval '90 days'),
    'revenue_cents', (select coalesce(sum(amount_cents - refunded_cents), 0) from payments where status in ('paid','partially_refunded')),
    'outstanding_cash_cents', (select coalesce(sum(amount_cents), 0) from payments where method = 'cash' and status = 'pending'),
    'outstanding_payments', (select count(*) from applications a join events e on e.id = a.event_id
                             where a.status in ('approved','confirmed') and e.price_cents > 0 and e.starts_at > now()
                               and not public.has_paid(a.id, 'fee')),
    'outstanding_waivers', (select count(*) from applications a join events e on e.id = a.event_id
                            where a.status in ('approved','confirmed') and e.starts_at > now()
                              and exists (select 1 from public.missing_waivers(a.event_id, a.user_id))),
    'revenue_by_category', (select coalesce(jsonb_agg(r order by r.cents desc), '[]') from (
        select c.name, sum(p.amount_cents - p.refunded_cents) cents from payments p
        join events e on e.id = p.event_id join activity_categories c on c.id = e.category_id
        where p.status in ('paid','partially_refunded') group by c.name) r),
    'popular_categories', (select coalesce(jsonb_agg(r order by r.applications desc), '[]') from (
        select c.name, count(a.id) applications from activity_categories c
        left join events e on e.category_id = c.id left join applications a on a.event_id = e.id
        group by c.name having count(a.id) > 0 order by count(a.id) desc limit 8) r)
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create or replace function public.send_announcement(p_audience public.announcement_audience, p_title text, p_body text,
    p_event uuid default null, p_group uuid default null, p_user uuid default null)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_auth(); v_n int; v_link text; e events;
begin
  if p_audience in ('event_participants','event_waitlisted') then
    if p_event is null then raise exception 'Choose an event'; end if;
    perform public.require_event_staff(p_event);
    select * into e from events where id = p_event;
    v_link := '/activities/' || e.slug || case when p_audience = 'event_participants' then '/hub' else '' end;
  elsif not public.is_admin(v_actor) then
    raise exception 'Only administrators can message this audience' using errcode = '42501';
  end if;

  with recipients as (
    select p.id from profiles p where p.deleted_at is null and p.status = 'active' and p_audience = 'all_members'
    union select a.user_id from applications a where p_audience = 'event_participants' and a.event_id = p_event
          and a.status in ('approved','confirmed','attended')
    union select a.user_id from applications a where p_audience = 'event_waitlisted' and a.event_id = p_event
          and a.status = 'waitlisted'
    union select gm.user_id from member_group_members gm where p_audience = 'group' and gm.group_id = p_group
    union select p_user where p_audience = 'individual' and p_user is not null
  ), sent as (
    select public.notify(r.id, 'announcement', p_title, p_body, v_link, p_event) from recipients r
  )
  select count(*) into v_n from sent;

  insert into announcements(audience, event_id, group_id, target_user_id, title, body, recipient_count, sent_by)
  values (p_audience, p_event, p_group, p_user, p_title, p_body, v_n, v_actor);
  if p_audience = 'event_participants' then
    insert into event_posts(event_id, author_id, body, is_announcement, pinned)
    values (p_event, v_actor, p_title || E'\n\n' || p_body, true, false);
  end if;
  perform public.audit('announcement.sent', 'announcement', p_audience::text, jsonb_build_object('recipients', v_n, 'event', p_event));
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------------
create or replace function public.convert_suggestion_to_event(p_suggestion uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_admin(); s suggestions; v_id uuid; v_cat uuid; v_slug text;
begin
  select * into s from suggestions where id = p_suggestion for update;
  if s.id is null then raise exception 'Suggestion not found'; end if;
  if s.converted_event_id is not null then return s.converted_event_id; end if;
  v_cat := coalesce(s.category_id, (select id from activity_categories order by sort_order limit 1));
  v_slug := left(regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g'), 50) || '-' || substr(md5(random()::text), 1, 5);
  insert into events(slug, title, category_id, description, general_location, difficulty, starts_at,
                     max_participants, external_links, source_suggestion_id, created_by, hidden_fields)
  values (trim(both '-' from v_slug), s.name, v_cat, coalesce(s.explanation, ''), s.location, s.difficulty,
          date_trunc('day', now()) + interval '30 days 8 hours', 12,
          case when s.external_link is not null then jsonb_build_array(jsonb_build_object('label','Suggested link','url', s.external_link)) else '[]'::jsonb end,
          s.id, v_actor, (select hidden_fields from activity_categories where id = v_cat))
  returning id into v_id;
  insert into event_private_details(event_id) values (v_id);
  update suggestions set status = 'converted', converted_event_id = v_id where id = s.id;
  if s.user_id is not null then
    perform public.notify(s.user_id, 'suggestion_update', 'Your suggestion is being planned',
      '"' || s.name || '" is now being planned as a community activity. Thanks for the idea!', '/suggestions');
  end if;
  perform public.audit('suggestion.converted', 'suggestion', s.id::text, jsonb_build_object('event', v_id));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Scheduled jobs (called by /api/cron every 15 minutes with the service role)
-- ---------------------------------------------------------------------------
create table public.reminders_sent (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  kind     text not null,
  sent_at  timestamptz not null default now(),
  primary key (event_id, user_id, kind)
);

create or replace function public.run_scheduled_jobs()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_offers int := 0; v_confirm int := 0; v_rem int := 0; v_done int := 0; v_lift int := 0;
begin
  -- 1. Expired waitlist offers / invitations: release and move on.
  for r in select a.*, e.title from applications a join events e on e.id = a.event_id
           where a.status = 'awaiting_confirmation' and a.offer_expires_at < now() for update of a loop
    update applications set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Offer expired',
           offer_expires_at = null where id = r.id;
    perform public.notify(r.user_id, 'offer_expired', 'Offer expired: ' || r.title,
      'The time to accept this place has passed. You are welcome to apply for other activities.', '/activities', r.event_id);
    perform public.handle_spot_released(r.event_id, r.id);
    v_offers := v_offers + 1;
  end loop;

  -- 2. Approved but never confirmed by the deadline (no attendance penalty).
  for r in select a.*, e.title from applications a join events e on e.id = a.event_id
           where a.status = 'approved' and a.confirm_by < now() for update of a loop
    update applications set status = 'cancelled', cancelled_at = now(),
           cancellation_reason = 'Confirmation deadline passed' where id = r.id;
    perform public.notify(r.user_id, 'confirmation_expired', 'Place released: ' || r.title,
      'We didn''t receive your confirmation in time, so your place was offered to someone else.', '/dashboard/activities', r.event_id);
    perform public.handle_spot_released(r.event_id, r.id);
    v_confirm := v_confirm + 1;
  end loop;

  -- 3. Reminders to approved members with outstanding steps (24h before their deadline).
  for r in select a.user_id, a.event_id, e.title, e.slug from applications a join events e on e.id = a.event_id
           where a.status = 'approved' and a.confirm_by between now() and now() + interval '24 hours'
             and not exists (select 1 from reminders_sent s where s.event_id = a.event_id and s.user_id = a.user_id and s.kind = 'confirm') loop
    perform public.notify(r.user_id, 'outstanding_steps', 'Action needed: ' || r.title,
      'Please sign any outstanding waivers, complete payment and confirm your attendance before your deadline.',
      '/dashboard/activities', r.event_id);
    insert into reminders_sent values (r.event_id, r.user_id, 'confirm');
    v_rem := v_rem + 1;
  end loop;

  -- 4. Upcoming event reminders (48h before) for confirmed participants.
  for r in select a.user_id, a.event_id, e.title, e.slug from applications a join events e on e.id = a.event_id
           where a.status = 'confirmed' and e.status = 'published' and e.starts_at between now() and now() + interval '48 hours'
             and not exists (select 1 from reminders_sent s where s.event_id = a.event_id and s.user_id = a.user_id and s.kind = '48h') loop
    perform public.notify(r.user_id, 'event_reminder', 'Coming up: ' || r.title,
      'Your activity is in less than 48 hours. Review the meeting details, gear checklist and weather notes.',
      '/activities/' || r.slug || '/hub', r.event_id);
    insert into reminders_sent values (r.event_id, r.user_id, '48h');
    v_rem := v_rem + 1;
  end loop;

  -- 5. Outstanding cash/online payments for confirmed members (once, 72h before).
  for r in select a.user_id, a.event_id, e.title from applications a join events e on e.id = a.event_id
           where a.status = 'confirmed' and e.price_cents > 0 and not public.has_paid(a.id, 'fee')
             and a.payment_choice = 'online' and e.starts_at between now() and now() + interval '72 hours'
             and not exists (select 1 from reminders_sent s where s.event_id = a.event_id and s.user_id = a.user_id and s.kind = 'payment') loop
    perform public.notify(r.user_id, 'outstanding_payment', 'Payment outstanding: ' || r.title,
      'Please complete your payment before the event.', '/dashboard/payments', r.event_id);
    insert into reminders_sent values (r.event_id, r.user_id, 'payment');
    v_rem := v_rem + 1;
  end loop;

  -- 6. Close out events that finished more than 3 days ago.
  update events set status = 'completed', registration_open = false
  where status = 'published' and coalesce(ends_at, starts_at) < now() - interval '3 days';
  get diagnostics v_done = row_count;

  -- 7. Time-limited restrictions/suspensions expire automatically.
  update profiles set status = 'active', status_reason = null, restricted_until = null, status_changed_at = now()
  where status in ('restricted','suspended') and restricted_until is not null and restricted_until < now();
  get diagnostics v_lift = row_count;

  return jsonb_build_object('offers_expired', v_offers, 'confirmations_expired', v_confirm,
                            'reminders', v_rem, 'events_completed', v_done, 'restrictions_lifted', v_lift);
end $$;

-- Data retention (owner-configurable windows, in days).
create or replace function public.purge_expired_data()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg jsonb := coalesce(public.setting('retention'), '{}');
  v_notif int; v_mail int; v_audit int; v_posts int;
begin
  delete from notifications where read_at is not null
    and created_at < now() - make_interval(days => coalesce((cfg ->> 'notifications_days')::int, 180));
  get diagnostics v_notif = row_count;
  delete from email_outbox where status in ('sent','skipped','failed')
    and created_at < now() - make_interval(days => coalesce((cfg ->> 'email_outbox_days')::int, 90));
  get diagnostics v_mail = row_count;
  delete from audit_log where created_at < now() - make_interval(days => coalesce((cfg ->> 'audit_log_days')::int, 2555));
  get diagnostics v_audit = row_count;
  delete from event_posts p using events e where p.event_id = e.id
    and coalesce(e.ends_at, e.starts_at) < now() - make_interval(days => coalesce((cfg ->> 'event_discussion_days')::int, 365));
  get diagnostics v_posts = row_count;
  return jsonb_build_object('notifications', v_notif, 'emails', v_mail, 'audit', v_audit, 'posts', v_posts);
end $$;

-- ---------------------------------------------------------------------------
-- Personal data: export and deletion
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from profiles p where p.id = auth.uid()),
    'private', (select to_jsonb(m) from member_private m where m.user_id = auth.uid()),
    'applications', (select coalesce(jsonb_agg(jsonb_build_object('event', e.title, 'starts_at', e.starts_at,
                       'status', a.status, 'attendance', a.attendance, 'applied_at', a.created_at, 'answers', a.answers)), '[]')
                     from applications a join events e on e.id = a.event_id where a.user_id = auth.uid()),
    'waiver_signatures', (select coalesce(jsonb_agg(jsonb_build_object('waiver', t.title, 'version', s.version,
                            'signed_at', s.signed_at, 'signature', s.signature_name)), '[]')
                          from waiver_signatures s join waiver_templates t on t.id = s.template_id where s.user_id = auth.uid()),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('event', e.title, 'amount_cents', p.amount_cents,
                   'status', p.status, 'method', p.method, 'receipt', p.receipt_number, 'paid_at', p.paid_at)), '[]')
                 from payments p join events e on e.id = p.event_id where p.user_id = auth.uid()),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('event_id', event_id, 'body', body, 'created_at', created_at)), '[]')
              from event_posts where author_id = auth.uid()),
    'suggestions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from suggestions s where s.user_id = auth.uid()),
    'appeals', (select coalesce(jsonb_agg(jsonb_build_object('explanation', explanation, 'status', status,
                  'decision', decision_message, 'created_at', created_at)), '[]') from appeals where user_id = auth.uid()),
    'warnings', (select coalesce(jsonb_agg(jsonb_build_object('message', message, 'created_at', created_at)), '[]')
                 from member_warnings where user_id = auth.uid()),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'body', body, 'created_at', created_at)), '[]')
                      from notifications where user_id = auth.uid())
  );
$$;

-- Anonymises the member. Waiver signatures and payment records are retained
-- (legal / financial obligations) but detached from contact details.
-- The server action then deletes the auth user's login via the Admin API.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_auth();
begin
  if public.is_owner(v_user) and (select count(*) from staff_roles where role = 'owner') <= 1 then
    raise exception 'Transfer ownership to another member before deleting the only owner account';
  end if;
  update applications a set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Account deleted'
  from events e where a.event_id = e.id and a.user_id = v_user and e.starts_at > now()
    and a.status in ('submitted','under_review','approved','awaiting_confirmation','confirmed','waitlisted');
  update event_posts set body = '[deleted]', author_id = null where author_id = v_user;
  delete from carpool_riders where rider_id = v_user;
  delete from carpool_offers where driver_id = v_user;
  delete from suggestion_votes where user_id = v_user;
  delete from member_group_members where user_id = v_user;
  delete from staff_roles where user_id = v_user;
  delete from notifications where user_id = v_user;
  update member_private set last_name = 'Deleted', email = 'deleted+' || v_user || '@invalid.local', phone = '',
         emergency_contact_name = '', emergency_contact_phone = '', emergency_contact_relationship = null, medical_notes = null
  where user_id = v_user;
  update profiles set first_name = 'Former member', last_initial = 'X', avatar_url = null, intro = '', interests = '{}',
         city = null, experience_summary = null, fitness_self_assessment = null, preferred_pace = null,
         languages = '{}', skills_certifications = '{}', weekend_availability = '{}', status = 'removed',
         email_notifications = false, deleted_at = now()
  where id = v_user;
  insert into audit_log(actor_id, action, entity, entity_id) values (v_user, 'member.account_deleted', 'profile', v_user::text);
end $$;
