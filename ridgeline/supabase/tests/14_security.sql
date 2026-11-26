begin;
\ir _helpers.sql
-- Private data isolation
call tests.login('jordan');
select tests.ok((select count(*) from member_private) = 1, 'members only see their own private contact row');
select tests.ok((select count(*) from profiles) = 1, 'members only see their own full profile');
select tests.ok((select count(*) from applications where user_id <> tests.u('jordan')) = 0, 'members cannot see other members'' applications');
select tests.ok((select count(*) from payments where user_id <> tests.u('jordan')) = 0, 'members cannot see other members'' payments');
select tests.ok((select count(*) from audit_log) = 0, 'members cannot read the audit log');
select tests.ok((select display_name from public_profiles where id = tests.u('maya')) = 'Maya C.', 'public profile shows first name + last initial');
select tests.ok(not exists (select 1 from information_schema.columns where table_name = 'public_profiles' and column_name in ('last_name','phone','email')),
  'public profile view has no sensitive columns');
select tests.throws($$ update profiles set status = 'active' where id = tests.u('jordan') $$, 'permission denied');
select tests.throws($$ update member_private set email = 'x@example.com' where user_id = tests.u('jordan') $$, 'permission denied');
select tests.ok(true, 'members cannot change their own status or verified email');
update profiles set intro = 'Updated intro' where id = tests.u('jordan');
select tests.ok((select intro from profiles where id = tests.u('jordan')) = 'Updated intro', 'members can edit their own profile fields');
select tests.throws($$ select run_scheduled_jobs() $$, 'permission denied');
select tests.throws($$ select bootstrap_owner('jordan@example.com') $$, 'permission denied');
select tests.throws($$ select set_member_status(tests.u('ben'), 'suspended') $$, 'Administrator access required');
select tests.throws($$ select get_event_emergency_contacts(tests.ev('dog-mountain-snowshoe')) $$, 'not an organizer');

-- Restricted logistics
call tests.login('marco');   -- applied (submitted) but not selected yet
select tests.ok(not exists (select 1 from event_private_details where event_id = tests.ev('dog-mountain-snowshoe')), 'restricted logistics hidden from non-selected members');
call tests.login('aisha');   -- confirmed
select tests.ok(exists (select 1 from event_private_details where event_id = tests.ev('dog-mountain-snowshoe')), 'confirmed participants see exact meeting details');
call tests.anon();
select tests.ok(exists (select 1 from event_private_details where event_id = tests.ev('burnaby-lake-night-trail-run')), 'unrestricted logistics are public');
select tests.ok(not exists (select 1 from events where status = 'draft'), 'anonymous visitors cannot see drafts');
select tests.ok(exists (select 1 from event_listing where slug = 'dog-mountain-snowshoe'), 'anonymous visitors can browse published events');
select tests.throws($$ select * from public_profiles $$, 'permission denied');

-- Organizer scope and audited emergency access
call tests.login('priya');
select tests.ok((select count(*) from get_event_emergency_contacts(tests.ev('dog-mountain-snowshoe'))) > 0, 'organizer can view emergency contacts for own event');
select tests.throws($$ select get_event_emergency_contacts(tests.ev('whistler-ski-carpool-day')) $$, 'not an organizer');
select tests.ok((select count(*) from applications where event_id = tests.ev('whistler-ski-carpool-day')) = 0, 'organizer cannot see applications for other events');
call tests.su();
select tests.ok(exists (select 1 from audit_log where action = 'emergency_contacts.viewed' and actor_id = tests.u('priya')), 'emergency-contact access is audited');

-- Discussion is limited to participants
call tests.login('marco');
select tests.throws($$ insert into event_posts(event_id, author_id, body) values (tests.ev('dog-mountain-snowshoe'), tests.u('marco'), 'hi') $$, 'row-level security');
call tests.login('aisha');
insert into event_posts(event_id, author_id, body) values (tests.ev('dog-mountain-snowshoe'), tests.u('aisha'), 'Excited!');
select tests.throws($$ insert into event_posts(event_id, author_id, body, is_announcement) values (tests.ev('dog-mountain-snowshoe'), tests.u('aisha'), 'fake', true) $$, 'row-level security');
select tests.ok(true, 'only participants post; only staff post announcements');

-- Moderators can hide posts; hidden posts disappear for participants
call tests.login('sofia');
select moderate_post((select id from event_posts where body = 'Excited!'), true, 'test');
call tests.login('jordan');
select tests.ok(not exists (select 1 from event_posts where body = 'Excited!'), 'hidden posts are not visible to participants');

-- Owner-only settings
call tests.login('daniel');
update site_settings set value = 'false' where key = 'require_member_approval';  -- RLS: matches no rows for admins
select tests.ok((select value from site_settings where key = 'require_member_approval') = 'true'::jsonb, 'admins cannot change owner-only settings');
select tests.throws($$ select set_staff_role(tests.u('jordan'), 'admin', true) $$, 'Only an owner');
call tests.login('maya');
select set_staff_role(tests.u('jordan'), 'organizer', true);
select tests.ok(has_role('organizer', tests.u('jordan')), 'owner can grant staff roles');
select tests.throws($$ select set_staff_role(tests.u('maya'), 'owner', false) $$, 'at least one owner');

-- Membership approval
call tests.login('daniel');
select set_member_status(tests.u('sam'), 'active', null, 'Looks great — Squamish local.');
call tests.su();
select tests.ok((select status from profiles where id = tests.u('sam')) = 'active', 'admin approves pending member');
select tests.ok(exists (select 1 from notifications where user_id = tests.u('sam') and type = 'membership_decision' and body not ilike '%Squamish local%'),
  'member notification never includes internal notes');

-- Registration requires all mandatory fields and consents
select tests.throws($$ insert into auth.users(email, raw_user_meta_data) values ('x@example.com', '{"first_name":"X"}') $$, 'Missing required registration field');
select tests.throws($$ insert into auth.users(email, raw_user_meta_data) values ('y@example.com',
  '{"first_name":"Y","last_name":"Z","phone":"1","emergency_contact_name":"A","emergency_contact_phone":"2","intro":"hi","age_confirmed":true,"guidelines_accepted":true,"privacy_accepted":false,"terms_accepted":true}') $$,
  'privacy_accepted');
select tests.ok(true, 'sign-up rejects missing fields and consents');

-- Account deletion anonymises but keeps waiver records
call tests.login('zoe');
select delete_my_account();
call tests.su();
select tests.ok((select status from profiles p join member_private m on m.user_id = p.id where m.email::text like 'deleted+%' limit 1) = 'removed', 'deleted account is anonymised');
select tests.ok((select count(*) from waiver_signatures s join member_private m on m.user_id = s.user_id where m.email::text like 'deleted+%') > 0, 'waiver records retained after deletion');
rollback;
