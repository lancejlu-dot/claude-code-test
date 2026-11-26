begin;
\ir _helpers.sql
-- Move Lighthouse-style scenario onto an upcoming event: Burnaby run confirmed participants
call tests.su();
update events set starts_at = now() - interval '3 hours', ends_at = now() - interval '2 hours' where id = tests.ev('burnaby-lake-night-trail-run');

-- Organizer records a no-show: pending admin confirmation, no restriction yet
call tests.login('sofia');
select record_attendance(tests.app('ben','burnaby-lake-night-trail-run'), 'unexcused_no_show');
select record_attendance(tests.app('ethan','burnaby-lake-night-trail-run'), 'attended');
select record_attendance(tests.app('noah','burnaby-lake-night-trail-run'), 'excused_absence', 'Sick — messaged the organizer');
call tests.su();
select tests.ok((select status from profiles where id = tests.u('ben')) = 'active', 'organizer-recorded no-show does not restrict until an admin confirms');
select tests.ok((select status from profiles where id = tests.u('noah')) = 'active', 'excused absence never restricts');

-- Admin confirms => automatic restriction + notification
call tests.login('daniel');
select confirm_no_show(tests.app('ben','burnaby-lake-night-trail-run'));
call tests.su();
select tests.ok((select status from profiles where id = tests.u('ben')) = 'restricted', 'confirmed unexcused no-show restricts the member automatically');
select tests.ok(exists (select 1 from notifications where user_id = tests.u('ben') and type = 'no_show_restriction'), 'member is notified of the restriction');

-- Restricted member cannot apply, can appeal
call tests.login('ben');
select tests.throws($$ select apply_to_event(tests.ev('stanley-park-pacific-spirit-ride')) $$, 'restricted');
select tests.throws($$ select submit_appeal('too short') $$, '20+ characters');
select submit_appeal('My bike tire blew on the way and I had no signal to cancel. Sorry!', tests.app('ben','burnaby-lake-night-trail-run'));
select tests.throws($$ select submit_appeal('Another appeal while one is open, should fail.') $$, 'already have an appeal');
-- Members never see confidential notes
select tests.ok((select count(*) from admin_notes) = 0, 'members cannot read admin notes');

-- Admin approves appeal => restored, no-show re-classified as excused
call tests.login('daniel');
select decide_appeal((select id from appeals where user_id = tests.u('ben') and status = 'submitted'), true, 'Thanks for explaining. Restored.');
call tests.su();
select tests.ok((select status from profiles where id = tests.u('ben')) = 'active', 'approved appeal restores booking privileges');
select tests.ok((select attendance from applications where id = tests.app('ben','burnaby-lake-night-trail-run')) = 'excused_absence', 'appealed no-show becomes excused');

-- Event cancellation never penalises
call tests.login('liam');
select cancel_event(tests.ev('whistler-ski-carpool-day'), 'Highway 99 closed', true);
call tests.su();
select tests.ok((select count(*) from applications where event_id = tests.ev('whistler-ski-carpool-day') and status <> 'cancelled') = 0, 'cancelling an event cancels all applications');
select tests.ok((select attendance from applications where id = tests.app('noah','whistler-ski-carpool-day')) = 'event_cancelled', 'participants are marked event_cancelled');
select tests.ok((select status from profiles where id = tests.u('noah')) = 'active', 'event cancellation does not restrict members');
select tests.ok(exists (select 1 from notifications where user_id = tests.u('noah') and type = 'weather_cancellation'), 'weather cancellation notification sent');

-- Late vs in-period member cancellation
update events set cancellation_deadline = now() - interval '1 hour' where id = tests.ev('hollyburn-peak-snowshoe');
call tests.login('ava');
select tests.ok(cancel_my_application(tests.app('ava','hollyburn-peak-snowshoe'), 'Work') = 'late_cancellation', 'cancelling after the deadline is a late cancellation');
call tests.login('lucas');
select tests.ok(cancel_my_application(tests.app('lucas','hollyburn-peak-snowshoe'), 'Knee injury', true) = 'excused_absence', 'safety/emergency withdrawals are excused');
call tests.login('aisha');
select tests.ok(cancel_my_application(tests.app('aisha','lynn-headwaters-norvan-falls')) = 'cancelled_in_period', 'cancelling before the deadline is in-period');
call tests.su();
select tests.ok((select status from profiles where id = tests.u('ava')) = 'active', 'late cancellation does not automatically restrict');
rollback;
