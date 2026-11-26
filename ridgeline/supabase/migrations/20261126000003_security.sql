-- =============================================================================
-- Ridgeline Collective — Row Level Security, grants, views
-- Default deny: revoke everything, then grant the minimum per table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Member-safe views and read helpers
-- ---------------------------------------------------------------------------

-- Limited public profile: first name + last initial and opted-in fields only.
create view public.public_profiles with (security_barrier = true) as
select p.id,
       p.first_name,
       p.last_initial,
       p.first_name || ' ' || p.last_initial || '.' as display_name,
       p.avatar_url,
       p.intro,
       p.interests,
       case when p.show_experience then p.hiking_experience end as hiking_experience,
       case when p.show_experience then p.experience_summary end as experience_summary,
       case when p.show_experience then p.skills_certifications else '{}'::text[] end as skills_certifications,
       p.languages,
       p.created_at as member_since,
       (select count(*)::int from applications a where a.user_id = p.id and a.status = 'attended') as completed_count,
       coalesce((select jsonb_agg(jsonb_build_object('name', b.name, 'icon', b.icon, 'description', b.description) order by mb.awarded_at)
                 from member_badges mb join badges b on b.id = mb.badge_id where mb.user_id = p.id), '[]') as badges
from profiles p
where p.deleted_at is null and p.status in ('active','restricted');

-- Event listing with computed availability; respects events RLS (security_invoker).
create view public.event_listing with (security_invoker = true) as
select e.*,
       c.slug as category_slug, c.name as category_name, c.icon as category_icon,
       r.slug as region_slug, r.name as region_name,
       public.event_spots_left(e.id) as spots_left,
       public.event_spots_taken(e.id) as spots_taken,
       public.event_waitlist_count(e.id) as waitlist_count,
       public.event_public_status(e.id) as public_status
from events e
join activity_categories c on c.id = e.category_id
left join regions r on r.id = e.region_id;

-- Participants of an event, as limited profiles. Only visible to participants and staff.
create or replace function public.event_participants(p_event uuid)
returns table(user_id uuid, display_name text, avatar_url text, intro text, completed_count int,
              is_organizer boolean, status public.application_status)
language sql stable security definer set search_path = public, pg_temp as $$
  select pp.id, pp.display_name, pp.avatar_url, pp.intro, pp.completed_count,
         exists (select 1 from event_organizers eo where eo.event_id = p_event and eo.user_id = pp.id),
         a.status
  from applications a join public_profiles pp on pp.id = a.user_id
  where a.event_id = p_event and a.status in ('confirmed','attended','approved')
    and (public.is_event_participant(p_event) or public.is_event_staff(p_event) or public.is_moderator())
  order by pp.first_name;
$$;

-- Organizers of an event as limited profiles (public).
create or replace function public.event_organizer_profiles(p_event uuid)
returns table(user_id uuid, display_name text, avatar_url text, intro text, is_lead boolean, completed_count int)
language sql stable security definer set search_path = public, pg_temp as $$
  select pp.id, pp.display_name, pp.avatar_url, pp.intro, eo.is_lead, pp.completed_count
  from event_organizers eo join public_profiles pp on pp.id = eo.user_id
  where eo.event_id = p_event order by eo.is_lead desc, pp.first_name;
$$;

-- Moderation of discussion posts.
create or replace function public.moderate_post(p_post uuid, p_hidden boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_auth(); v_event uuid;
begin
  select event_id into v_event from event_posts where id = p_post;
  if not (public.is_moderator(v_actor) or public.is_event_staff(v_event, v_actor)) then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  update event_posts set hidden = p_hidden, hidden_by = case when p_hidden then v_actor end,
         hidden_reason = case when p_hidden then p_reason end where id = p_post;
  perform public.audit(case when p_hidden then 'post.hidden' else 'post.restored' end, 'event_post', p_post::text,
                       jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.pin_post(p_post uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event uuid;
begin
  select event_id into v_event from event_posts where id = p_post;
  perform public.require_event_staff(v_event);
  update event_posts set pinned = p_pinned where id = p_post;
end $$;

create or replace function public.resolve_report(p_report uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := public.require_auth();
begin
  if not public.is_moderator(v_actor) then raise exception 'Moderator access required' using errcode = '42501'; end if;
  update content_reports set status = p_status, resolution_note = p_note, handled_by = v_actor, handled_at = now()
  where id = p_report;
  perform public.audit('report.' || p_status, 'content_report', p_report::text, '{}');
end $$;

-- Reports go to moderators; the reporter's identity is never shown to the reported member.
create or replace function public.notify_new_report() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.notify(s.user_id, 'report_submitted',
    case when new.category = 'safety' then 'Safety concern reported' else 'New member report' end,
    'A private report needs review.', '/admin/moderation')
  from (select distinct user_id from staff_roles where role in ('owner','admin','moderator')) s;
  return new;
end $$;
create trigger content_reports_notify after insert on public.content_reports
  for each row execute function public.notify_new_report();

-- Carpool seat limit.
create or replace function public.check_carpool_seats() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_seats int; v_taken int; v_event uuid; v_driver uuid;
begin
  select seats, event_id, driver_id into v_seats, v_event, v_driver from carpool_offers where id = new.offer_id for update;
  if v_driver = new.rider_id then raise exception 'You are the driver of this carpool'; end if;
  select count(*) into v_taken from carpool_riders where offer_id = new.offer_id;
  if v_taken >= v_seats then raise exception 'This carpool is full'; end if;
  if not public.is_event_participant(v_event, new.rider_id) then raise exception 'Only participants can join carpools'; end if;
  return new;
end $$;
create trigger carpool_riders_seats before insert on public.carpool_riders
  for each row execute function public.check_carpool_seats();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- RLS is not FORCEd: SECURITY DEFINER business functions run as the table owner
-- and intentionally bypass row policies after doing their own permission checks.

-- ---------------------------------------------------------------------------
-- Grants: start from nothing
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Public read (anon + authenticated)
grant select on public.regions, public.activity_categories, public.site_settings, public.events,
                public.event_private_details, public.event_organizers, public.event_waivers,
                public.faqs, public.policy_pages, public.highlights, public.badges, public.event_listing
  to anon, authenticated;

-- Authenticated read
grant select on public.profiles, public.member_private, public.staff_roles, public.member_groups,
                public.member_group_members, public.member_badges, public.waiver_templates, public.waiver_versions,
                public.applications, public.waiver_signatures, public.payments, public.refunds,
                public.member_warnings, public.appeals, public.admin_notes, public.event_posts,
                public.carpool_offers, public.carpool_riders, public.content_reports, public.headcounts,
                public.incidents, public.suggestions, public.suggestion_votes, public.notifications,
                public.email_outbox, public.announcements, public.audit_log, public.public_profiles
  to authenticated;

-- Member self-service writes (column-limited)
grant update (first_name, avatar_url, intro, interests, home_region_id, city, hiking_experience, experience_summary,
              preferred_difficulty, fitness_self_assessment, preferred_pace, weekend_availability, languages,
              has_vehicle, willing_to_carpool, skills_certifications, show_experience, email_notifications, photo_consent)
  on public.profiles to authenticated;
grant update (last_name, phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, medical_notes)
  on public.member_private to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert (event_id, author_id, body, is_announcement) on public.event_posts to authenticated;
grant update (body) on public.event_posts to authenticated;
grant delete on public.event_posts to authenticated;
grant insert, update, delete on public.carpool_offers to authenticated;
grant insert, delete on public.carpool_riders to authenticated;
grant insert (reporter_id, subject_user_id, event_id, post_id, category, details) on public.content_reports to authenticated;
grant insert (user_id, name, location, category_id, preferred_timing, difficulty, external_link, explanation, willing_to_help)
  on public.suggestions to authenticated;
grant update (status, admin_response) on public.suggestions to authenticated;
grant delete on public.suggestions to authenticated;
grant insert, delete on public.suggestion_votes to authenticated;

-- Staff writes (RLS narrows to the right role)
grant insert, update on public.events to authenticated;
grant insert, update on public.event_private_details to authenticated;
grant insert, delete on public.event_organizers, public.event_waivers to authenticated;
grant insert, update on public.waiver_templates to authenticated;
grant insert, update, delete on public.regions, public.activity_categories, public.faqs, public.policy_pages,
                                public.highlights, public.badges, public.member_badges, public.member_groups,
                                public.member_group_members to authenticated;
grant insert, update on public.site_settings to authenticated;
grant insert on public.headcounts to authenticated;
grant insert, update on public.incidents to authenticated;
grant update (status) on public.appeals to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Configuration
create policy regions_read on public.regions for select using (true);
create policy regions_write on public.regions for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy categories_read on public.activity_categories for select using (true);
create policy categories_write on public.activity_categories for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy settings_read on public.site_settings for select using (true);
create policy settings_write on public.site_settings for all to authenticated
  using (public.is_owner() or (public.is_admin() and key not in ('require_member_approval','retention','payments','general_waiver_template_id')))
  with check (public.is_owner() or (public.is_admin() and key not in ('require_member_approval','retention','payments','general_waiver_template_id')));

-- Profiles
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy private_read on public.member_private for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy private_update_self on public.member_private for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy staff_roles_read on public.staff_roles for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy groups_admin on public.member_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy group_members_admin on public.member_group_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy badges_read on public.badges for select using (true);
create policy badges_write on public.badges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy member_badges_read on public.member_badges for select to authenticated using (true);
create policy member_badges_write on public.member_badges for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Waivers
create policy waiver_templates_read on public.waiver_templates for select to authenticated using (active or public.is_admin());
create policy waiver_templates_write on public.waiver_templates for insert to authenticated with check (public.is_admin());
create policy waiver_templates_update on public.waiver_templates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy waiver_versions_read on public.waiver_versions for select to authenticated using (true);
create policy signatures_read on public.waiver_signatures for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or (event_id is not null and public.is_event_staff(event_id)));

-- Events
create policy events_read on public.events for select using (status <> 'draft' or public.is_event_staff(id));
create policy events_insert on public.events for insert to authenticated with check (public.is_admin());
create policy events_update on public.events for update to authenticated using (public.is_event_staff(id)) with check (public.is_event_staff(id));
create policy event_private_read on public.event_private_details for select using (
  public.is_event_staff(event_id) or public.is_event_participant(event_id)
  or exists (select 1 from events e where e.id = event_id and not e.restrict_logistics and e.status <> 'draft'));
create policy event_private_insert on public.event_private_details for insert to authenticated with check (public.is_event_staff(event_id));
create policy event_private_update on public.event_private_details for update to authenticated
  using (public.is_event_staff(event_id)) with check (public.is_event_staff(event_id));
create policy event_organizers_read on public.event_organizers for select using (true);
create policy event_organizers_write on public.event_organizers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy event_waivers_read on public.event_waivers for select using (true);
create policy event_waivers_write on public.event_waivers for all to authenticated
  using (public.is_event_staff(event_id)) with check (public.is_event_staff(event_id));

-- Applications & money (read-only; writes via functions)
create policy applications_read on public.applications for select to authenticated
  using (user_id = auth.uid() or public.is_event_staff(event_id));
create policy payments_read on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_event_staff(event_id));
create policy refunds_read on public.refunds for select to authenticated
  using (public.is_admin() or exists (select 1 from payments p where p.id = payment_id and p.user_id = auth.uid()));

-- Accountability
create policy warnings_read on public.member_warnings for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy appeals_read on public.appeals for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy appeals_update on public.appeals for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_notes_read on public.admin_notes for select to authenticated using (public.is_admin());

-- Event community
create policy posts_read on public.event_posts for select to authenticated using (
  (public.is_event_participant(event_id) and not hidden) or public.is_event_staff(event_id) or public.is_moderator());
create policy posts_insert on public.event_posts for insert to authenticated with check (
  author_id = auth.uid()
  and public.my_status() = 'active'
  and (public.is_event_participant(event_id) or public.is_event_staff(event_id))
  and (not is_announcement or public.is_event_staff(event_id)));
create policy posts_update_own on public.event_posts for update to authenticated
  using (author_id = auth.uid() and not hidden) with check (author_id = auth.uid());
create policy posts_delete_own on public.event_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

create policy carpool_read on public.carpool_offers for select to authenticated
  using (public.is_event_participant(event_id) or public.is_event_staff(event_id));
create policy carpool_insert on public.carpool_offers for insert to authenticated
  with check (driver_id = auth.uid() and public.is_event_participant(event_id));
create policy carpool_update on public.carpool_offers for update to authenticated
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy carpool_delete on public.carpool_offers for delete to authenticated
  using (driver_id = auth.uid() or public.is_event_staff(event_id));
create policy riders_read on public.carpool_riders for select to authenticated using (
  exists (select 1 from carpool_offers o where o.id = offer_id
          and (public.is_event_participant(o.event_id) or public.is_event_staff(o.event_id))));
create policy riders_insert on public.carpool_riders for insert to authenticated with check (rider_id = auth.uid());
create policy riders_delete on public.carpool_riders for delete to authenticated using (
  rider_id = auth.uid() or exists (select 1 from carpool_offers o where o.id = offer_id and o.driver_id = auth.uid()));

create policy reports_insert on public.content_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read on public.content_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

create policy headcounts_rw on public.headcounts for select to authenticated using (public.is_event_staff(event_id));
create policy headcounts_insert on public.headcounts for insert to authenticated
  with check (public.is_event_staff(event_id) and recorded_by = auth.uid());
create policy incidents_read on public.incidents for select to authenticated using (public.is_event_staff(event_id));
create policy incidents_insert on public.incidents for insert to authenticated
  with check (public.is_event_staff(event_id) and recorded_by = auth.uid());
create policy incidents_update on public.incidents for update to authenticated
  using (public.is_event_staff(event_id)) with check (public.is_event_staff(event_id));

-- Suggestions
create policy suggestions_read on public.suggestions for select to authenticated using (public.my_status() is not null);
create policy suggestions_insert on public.suggestions for insert to authenticated
  with check (user_id = auth.uid() and public.my_status() = 'active');
create policy suggestions_admin_update on public.suggestions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy suggestions_delete on public.suggestions for delete to authenticated
  using ((user_id = auth.uid() and status = 'submitted') or public.is_admin());
create policy votes_read on public.suggestion_votes for select to authenticated using (true);
create policy votes_insert on public.suggestion_votes for insert to authenticated
  with check (user_id = auth.uid() and public.my_status() = 'active');
create policy votes_delete on public.suggestion_votes for delete to authenticated using (user_id = auth.uid());

-- Communication
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy outbox_admin on public.email_outbox for select to authenticated using (public.is_admin());
create policy announcements_read on public.announcements for select to authenticated
  using (public.is_admin() or sent_by = auth.uid());

-- Content
create policy faqs_read on public.faqs for select using (published or public.is_admin());
create policy faqs_write on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy policies_read on public.policy_pages for select using (published or public.is_admin());
create policy policies_write on public.policy_pages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy highlights_read on public.highlights for select using ((published and consent_confirmed) or public.is_admin());
create policy highlights_write on public.highlights for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Audit
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Function execution grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helpers used inside RLS policies and public views must be executable by both roles.
grant execute on function
  public.has_role(public.staff_role, uuid), public.is_owner(uuid), public.is_admin(uuid), public.is_staff(uuid),
  public.is_moderator(uuid), public.is_event_staff(uuid, uuid), public.is_event_participant(uuid, uuid),
  public.my_status(), public.setting(text), public.event_spots_taken(uuid), public.event_spots_left(uuid),
  public.event_waitlist_count(uuid), public.event_public_status(uuid), public.community_stats(),
  public.event_organizer_profiles(uuid)
  to anon, authenticated;

-- Member and staff RPCs (each checks permissions internally).
grant execute on function
  public.apply_to_event(uuid, jsonb, text[], text, text, boolean, int),
  public.review_applications(uuid[], text, text, timestamptz),
  public.invite_member(uuid, uuid, text), public.offer_spot(uuid), public.respond_to_offer(uuid, boolean),
  public.confirm_participation(uuid, public.payment_method),
  public.cancel_my_application(uuid, text, boolean),
  public.sign_waiver(uuid, text, uuid, text, text), public.missing_waivers(uuid, uuid),
  public.has_valid_waiver(uuid, uuid), public.event_required_waivers(uuid),
  public.publish_waiver_version(uuid, text, text, boolean),
  public.register_checkout_session(uuid, public.payment_kind, text),
  public.record_cash_payment(uuid, int, text, public.payment_kind), public.waive_payment(uuid, text, public.payment_kind),
  public.record_refund(uuid, int, text, text), public.has_paid(uuid, public.payment_kind), public.amount_due(uuid, public.payment_kind),
  public.record_attendance(uuid, public.attendance_outcome, text), public.confirm_no_show(uuid),
  public.submit_appeal(text, uuid), public.decide_appeal(uuid, boolean, text, boolean),
  public.set_check_in(uuid, boolean), public.mark_departed_safely(uuid, boolean),
  public.get_event_emergency_contacts(uuid), public.member_reliability(uuid), public.my_activity_stats(),
  public.admin_dashboard_stats(),
  public.send_announcement(public.announcement_audience, text, text, uuid, uuid, uuid),
  public.convert_suggestion_to_event(uuid),
  public.set_member_status(uuid, public.member_status, text, text, timestamptz),
  public.issue_warning(uuid, text, uuid), public.add_admin_note(uuid, text, uuid),
  public.set_staff_role(uuid, public.staff_role, boolean),
  public.publish_event(uuid), public.postpone_event(uuid, text), public.cancel_event(uuid, text, boolean),
  public.complete_event(uuid), public.set_registration_open(uuid, boolean), public.duplicate_event(uuid),
  public.delete_event(uuid), public.event_participants(uuid), public.moderate_post(uuid, boolean, text),
  public.pin_post(uuid, boolean), public.resolve_report(uuid, public.report_status, text),
  public.export_my_data(), public.delete_my_account()
  to authenticated;

-- Service-role only: webhooks, scheduled jobs, bootstrap.
grant execute on function
  public.record_online_payment(text, text, int), public.mark_checkout_expired(text), public.record_refund(uuid, int, text, text),
  public.run_scheduled_jobs(), public.purge_expired_data(), public.bootstrap_owner(text)
  to service_role;
