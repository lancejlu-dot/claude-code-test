begin;
\ir _helpers.sql

-- Membership status gates applications
call tests.login('sam');
select tests.throws($$ select apply_to_event(tests.ev('dog-mountain-snowshoe'), '{"snowshoe_rental":"yes"}') $$, 'awaiting approval');
call tests.login('olivia');
select tests.throws($$ select apply_to_event(tests.ev('dog-mountain-snowshoe'), '{"snowshoe_rental":"yes"}') $$, 'restricted');
select tests.ok(true, 'pending and restricted members cannot apply');

-- Required event questions are enforced server-side
call tests.login('kenji');
select tests.throws($$ select apply_to_event(tests.ev('lynn-headwaters-norvan-falls'), '{}') $$, 'Please answer');
select tests.ok(apply_to_event(tests.ev('lynn-headwaters-norvan-falls'), '{"recent_hikes":"Elfin Lakes in July"}') is not null, 'active member can apply with required answers');
select tests.throws($$ select apply_to_event(tests.ev('lynn-headwaters-norvan-falls'), '{"recent_hikes":"again"}') $$, 'already applied');
select tests.ok((select status from applications where id = tests.app('kenji','lynn-headwaters-norvan-falls')) = 'submitted', 'new application is "submitted"');

-- Drafts and not-yet-open events reject applications
select tests.throws($$ select apply_to_event(tests.ev('golden-ears-gold-creek-falls')) $$, 'not accepting');
select tests.throws($$ select apply_to_event(tests.ev('harrison-hot-springs-weekend')) $$, 'not opened');

-- Members cannot write applications directly
select tests.throws($$ insert into applications(event_id, user_id, status) values (tests.ev('dog-mountain-snowshoe'), tests.u('kenji'), 'confirmed') $$, 'permission denied');
select tests.throws($$ update applications set status = 'confirmed' where user_id = tests.u('kenji') $$, 'permission denied');
select tests.ok(true, 'direct writes to applications are denied');

-- Only event staff can review
call tests.login('ethan');
select tests.throws($$ select review_applications(array[tests.app('hannah','hollyburn-peak-snowshoe')], 'approve') $$, 'not an organizer');
call tests.login('liam');  -- organizer, but not of this event
select tests.throws($$ select review_applications(array[tests.app('hannah','hollyburn-peak-snowshoe')], 'approve') $$, 'not an organizer');
select tests.ok(true, 'non-organizers cannot review applications');

-- Batch approval within capacity
call tests.login('emma');
select tests.ok(review_applications(array[tests.app('hannah','hollyburn-peak-snowshoe'), tests.app('kenji','hollyburn-peak-snowshoe')], 'approve', 'See you up there!') = 2,
  'organizer batch-approves two applicants');
select tests.ok((select confirm_by from applications where id = tests.app('hannah','hollyburn-peak-snowshoe')) is not null, 'approval sets a confirmation deadline');
call tests.su();
select tests.ok(exists (select 1 from notifications where user_id = tests.u('hannah') and type = 'application_approved'), 'approved member is notified');
select tests.ok(exists (select 1 from email_outbox where user_id = tests.u('hannah') and status = 'queued'), 'approval email is queued');

-- Capacity cannot be exceeded (Quarry Rock is full: 12/12)
call tests.login('sofia');
select tests.throws($$ select review_applications(array[tests.app('jordan','quarry-rock-sunrise-hike')], 'approve') $$, 'Not enough spaces');
select tests.ok(true, 'approval beyond capacity is rejected');
-- Organizers cannot shrink capacity below selected participants
select tests.throws($$ update events set max_participants = 5 where id = tests.ev('quarry-rock-sunrise-hike') $$, 'cannot be lower');
-- Status changes go through the lifecycle functions only
select tests.throws($$ update events set status = 'cancelled' where id = tests.ev('quarry-rock-sunrise-hike') $$, 'publish / postpone / cancel');
select tests.ok(true, 'capacity and status are protected from direct edits');

-- Not selected and waitlist
call tests.login('priya');
select review_applications(array[tests.app('chloe','lynn-headwaters-norvan-falls')], 'not_selected');
select review_applications(array[tests.app('ava','lynn-headwaters-norvan-falls'), tests.app('ben','lynn-headwaters-norvan-falls')], 'waitlist');
select tests.ok((select waitlist_position from applications where id = tests.app('ben','lynn-headwaters-norvan-falls')) = 2, 'waitlist positions are ordered');
select tests.ok((select status from applications where id = tests.app('chloe','lynn-headwaters-norvan-falls')) = 'not_selected', 'not selected status recorded');
rollback;
