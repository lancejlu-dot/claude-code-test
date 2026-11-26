begin;
\ir _helpers.sql

-- Free event, waivers already signed: confirmation succeeds
call tests.login('jordan');
select confirm_participation(tests.app('jordan','lynn-headwaters-norvan-falls'));
select tests.ok((select status from applications where id = tests.app('jordan','lynn-headwaters-norvan-falls')) = 'confirmed', 'free event confirms when waivers are signed');

-- Paid event: payment required (online or cash where allowed)
select tests.throws($$ select confirm_participation(tests.app('jordan','whistler-ski-carpool-day')) $$, 'Payment is required');
select confirm_participation(tests.app('jordan','whistler-ski-carpool-day'), 'cash');
select tests.ok((select status from applications where id = tests.app('jordan','whistler-ski-carpool-day')) = 'confirmed', 'cash choice confirms when cash is allowed');
call tests.su();
select tests.ok(exists (select 1 from payments where application_id = tests.app('jordan','whistler-ski-carpool-day') and method = 'cash' and status = 'pending'),
  'outstanding cash payment is tracked');

-- Online-only event cannot be confirmed with cash
call tests.su();
update applications set status = 'approved', confirm_by = now() + interval '1 day' where id = tests.app('hannah','indian-arm-winter-paddle');
insert into waiver_signatures(user_id, template_id, version_id, version, signature_name, signer_display, body_sha256)
  select tests.u('hannah'), template_id, id, version, 'Hannah Kim', 'Hannah Kim', 'x' from waiver_versions where template_id = '00000000-0000-4000-b000-000000000002';
call tests.login('hannah');
select tests.throws($$ select confirm_participation(tests.app('hannah','indian-arm-winter-paddle'), 'cash') $$, 'Payment is required');
select tests.ok(true, 'cash is refused when the event only allows online payment');

-- Members are not charged before approval
call tests.login('hannah');
select tests.throws($$ select register_checkout_session(tests.app('hannah','hollyburn-peak-snowshoe'), 'fee', 'cs_test') $$, 'after your application is approved');
select tests.ok(true, 'checkout is refused before approval');

-- Online payment via webhook (service role only)
select register_checkout_session(tests.app('hannah','indian-arm-winter-paddle'), 'fee', 'cs_test_123');
select tests.throws($$ select record_online_payment('cs_test_123', 'pi_1', 6500) $$, 'permission denied');
call tests.su();
set local role service_role;
select record_online_payment('cs_test_123', 'pi_1', 6500);
select record_online_payment('cs_test_123', 'pi_1', 6500); -- idempotent
reset role;
select tests.ok((select count(*) from payments where stripe_checkout_session_id = 'cs_test_123' and status = 'paid' and receipt_number is not null) = 1,
  'webhook records payment once with a receipt number');
call tests.login('hannah');
select confirm_participation(tests.app('hannah','indian-arm-winter-paddle'));
select tests.ok((select status from applications where id = tests.app('hannah','indian-arm-winter-paddle')) = 'confirmed', 'paid online + waiver signed => confirmed');

-- Waivers gate confirmation
call tests.login('noah');
select tests.throws($$ select confirm_participation(tests.app('noah','dog-mountain-snowshoe')) $$, 'sign the required waiver');
select tests.throws($$ select sign_waiver('00000000-0000-4000-b000-000000000003', 'Someone Else', tests.ev('dog-mountain-snowshoe')) $$, 'full name');
select sign_waiver('00000000-0000-4000-b000-000000000003', '  noah   patel ', tests.ev('dog-mountain-snowshoe'), '203.0.113.5', 'test-agent');
select confirm_participation(tests.app('noah','dog-mountain-snowshoe'));
select tests.ok((select status from applications where id = tests.app('noah','dog-mountain-snowshoe')) = 'confirmed', 'signing the waiver unblocks confirmation');
select tests.ok((select host(ip_address) from waiver_signatures where user_id = tests.u('noah') and template_id = '00000000-0000-4000-b000-000000000003') = '203.0.113.5',
  'signature records IP address');

-- Re-signing when terms change
call tests.login('daniel');
select publish_waiver_version('00000000-0000-4000-b000-000000000001', 'Updated terms', 'Clarified medical section', true);
call tests.su();
select tests.ok(exists (select 1 from missing_waivers(tests.ev('lynn-headwaters-norvan-falls'), tests.u('aisha'))), 'a re-sign version invalidates older signatures');
call tests.login('daniel');
select publish_waiver_version('00000000-0000-4000-b000-000000000002', 'Typo fix', 'Typo', false);
call tests.su();
select tests.ok(not exists (select 1 from missing_waivers(tests.ev('indian-arm-winter-paddle'), tests.u('hannah')) where template_id = '00000000-0000-4000-b000-000000000002'),
  'a non-material version does not force re-signing');

-- Confirmation deadline enforced
update applications set status = 'approved', confirm_by = now() - interval '1 minute' where id = tests.app('aisha','whistler-ski-carpool-day');
call tests.login('aisha');
select tests.throws($$ select confirm_participation(tests.app('aisha','whistler-ski-carpool-day'), 'cash') $$, 'deadline has passed');
select tests.ok(true, 'expired confirmation deadline blocks confirmation');
rollback;
