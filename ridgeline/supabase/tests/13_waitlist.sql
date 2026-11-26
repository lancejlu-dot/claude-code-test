begin;
\ir _helpers.sql
-- Automatic promotion
call tests.su();
update events set waitlist_mode = 'automatic' where id = tests.ev('quarry-rock-sunrise-hike');
call tests.login('aisha');
select cancel_my_application(tests.app('aisha','quarry-rock-sunrise-hike'));
call tests.su();
select tests.ok((select status from applications where id = tests.app('jordan','quarry-rock-sunrise-hike')) = 'awaiting_confirmation', 'next waitlisted member receives an offer automatically');
select tests.ok((select offer_expires_at from applications where id = tests.app('jordan','quarry-rock-sunrise-hike')) > now(), 'offer has a deadline');
select tests.ok(exists (select 1 from notifications where user_id = tests.u('sofia') and type = 'participant_cancelled'), 'organizer is notified of the cancellation');
call tests.login('jordan');
select respond_to_offer(tests.app('jordan','quarry-rock-sunrise-hike'), true);
select tests.ok((select status from applications where id = tests.app('jordan','quarry-rock-sunrise-hike')) = 'approved', 'accepting an offer approves the member');

-- Offer expiry via scheduled job, then the next person is offered
call tests.su();
update applications set status = 'waitlisted', waitlist_position = 1 where id = tests.app('marco','dog-mountain-snowshoe');
update events set max_participants = 13 where id = tests.ev('dog-mountain-snowshoe');  -- 10 taken + 1 reserved + ...
update events set waitlist_mode = 'automatic', reserved_spots = 0, max_participants = 10 where id = tests.ev('dog-mountain-snowshoe');
call tests.login('chloe');
select cancel_my_application(tests.app('chloe','dog-mountain-snowshoe'));
call tests.su();
select tests.ok((select status from applications where id = tests.app('marco','dog-mountain-snowshoe')) = 'awaiting_confirmation', 'offer made to waitlisted member');
update applications set offer_expires_at = now() - interval '1 minute' where id = tests.app('marco','dog-mountain-snowshoe');
set local role service_role;
select run_scheduled_jobs();
reset role;
select tests.ok((select status from applications where id = tests.app('marco','dog-mountain-snowshoe')) = 'cancelled', 'expired offers are released by the scheduled job');

-- Manual mode: no automatic offer
update events set waitlist_mode = 'manual' where id = tests.ev('lynn-headwaters-norvan-falls');
update applications set status = 'waitlisted', waitlist_position = 1 where id = tests.app('ava','lynn-headwaters-norvan-falls');
call tests.login('aisha');
select cancel_my_application(tests.app('aisha','lynn-headwaters-norvan-falls'));
call tests.su();
select tests.ok((select status from applications where id = tests.app('ava','lynn-headwaters-norvan-falls')) = 'waitlisted', 'manual mode waits for the organizer');
call tests.login('priya');
select offer_spot(tests.app('ava','lynn-headwaters-norvan-falls'));
select tests.ok((select status from applications where id = tests.app('ava','lynn-headwaters-norvan-falls')) = 'awaiting_confirmation', 'organizer can offer a space manually');

-- Invitations can use reserved spaces when the event is otherwise full
call tests.su();
update events set max_participants = 8 where id = tests.ev('whistler-ski-carpool-day');  -- 6 taken + 2 reserved = full
call tests.login('liam');
select invite_member(tests.ev('whistler-ski-carpool-day'), tests.u('kenji'), 'We need another strong skier!');
call tests.su();
select tests.ok((select reserved_spots from events where id = tests.ev('whistler-ski-carpool-day')) = 1, 'invitation consumed a reserved space');
call tests.login('liam');
select invite_member(tests.ev('whistler-ski-carpool-day'), tests.u('zoe'));
select tests.throws($$ select invite_member(tests.ev('whistler-ski-carpool-day'), tests.u('chloe')) $$, 'at capacity');
select tests.ok(true, 'invitations stop when reserved spaces run out');
rollback;
