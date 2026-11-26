-- =============================================================================
-- Base configuration and editable starter content (needed in production).
-- Everything here can be edited in the admin portal afterwards.
-- Policy and waiver text are DRAFTS that must be reviewed by a lawyer.
-- =============================================================================

-- Regions: Canada → British Columbia → Lower Mainland areas
insert into public.regions (id, parent_id, kind, name, slug, sort_order) values
  ('00000000-0000-4000-a000-000000000001', null, 'country', 'Canada', 'canada', 0),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000001', 'province', 'British Columbia', 'british-columbia', 0);
insert into public.regions (parent_id, kind, name, slug, sort_order)
select '00000000-0000-4000-a000-000000000002', 'area', n, s, o from (values
  ('Vancouver','vancouver',1), ('North Vancouver','north-vancouver',2), ('West Vancouver','west-vancouver',3),
  ('Burnaby','burnaby',4), ('Coquitlam','coquitlam',5), ('Port Moody','port-moody',6), ('Surrey','surrey',7),
  ('Richmond','richmond',8), ('Maple Ridge','maple-ridge',9), ('Langley','langley',10),
  ('Fraser Valley','fraser-valley',11), ('Squamish & Sea-to-Sky','squamish-sea-to-sky',12), ('Whistler','whistler',13)
) v(n, s, o);

-- Activity categories with sensible default hidden fields
insert into public.activity_categories (slug, name, icon, description, hidden_fields, tracks_distance, sort_order) values
  ('hiking','Hiking','mountain','Day hikes from forest loops to alpine summits.','{}',true,1),
  ('kayaking','Kayaking','waves','Sea and lake paddling with experienced leads.','{elevation_gain_m}',true,2),
  ('paddleboarding','Paddleboarding','sailboat','Calm-water SUP sessions and sunset paddles.','{elevation_gain_m}',true,3),
  ('camping','Camping','tent','Car-camping weekends at BC campgrounds.','{elevation_gain_m,group_pace,distance_km}',false,4),
  ('backpacking','Backpacking','backpack','Multi-day overnight trips into the backcountry.','{}',true,5),
  ('snowshoeing','Snowshoeing','snowflake','Winter trails on the North Shore and beyond.','{}',true,6),
  ('skiing-snowboarding','Skiing & Snowboarding','mountain-snow','Resort days and carpools to the hill.','{distance_km,elevation_gain_m,group_pace}',false,7),
  ('cycling','Cycling','bike','Road and gravel rides around the Lower Mainland.','{}',true,8),
  ('trail-running','Trail Running','footprints','Social trail runs with regroup points.','{}',true,9),
  ('outdoor-fitness','Outdoor Fitness','dumbbell','Park workouts, stair climbs and bootcamps.','{elevation_gain_m,distance_km,transportation}',false,10),
  ('road-trips','Weekend Road Trips','car','Weekend adventures beyond the city.','{group_pace}',false,11),
  ('social','Community Socials','users','Post-hike patios, potlucks and gear swaps.','{distance_km,elevation_gain_m,group_pace,required_equipment,recommended_equipment,food_water,weather_considerations}',false,12);

-- Settings (owner-editable)
insert into public.site_settings (key, value, description) values
  ('brand', jsonb_build_object('name','Ridgeline Collective','tagline','Outdoor adventures with people who show up.',
     'region_label','Lower Mainland, BC','contact_email','hello@example.com'), 'Brand name, tagline and contact'),
  ('site_url', to_jsonb('http://localhost:3000'::text), 'Public URL used in emails'),
  ('require_member_approval', 'true', 'New members must be approved by an administrator'),
  ('default_cancellation_hours', '48', 'Default hours before start that members can cancel without it counting as late'),
  ('general_waiver_template_id', 'null', 'Waiver every member must sign before any activity'),
  ('retention', jsonb_build_object('notifications_days',180,'email_outbox_days',90,'audit_log_days',2555,
     'event_discussion_days',365,'deleted_account_records_days',2555), 'Data retention windows in days'),
  ('payments', jsonb_build_object('currency','CAD','refund_processing_note','Refunds are returned to the original payment method within 5–10 business days.'), 'Payment settings'),
  ('homepage', jsonb_build_object(
     'hero_title','Find your people on the trail.',
     'hero_subtitle','A curated outdoor community for the Lower Mainland. Small groups, experienced organizers, and members who show up.',
     'hero_image_url','/images/hero.svg',
     'values', jsonb_build_array(
        jsonb_build_object('title','Reliable by design','body','We select participants for each trip so groups are balanced, prepared and committed.'),
        jsonb_build_object('title','Safety first','body','Clear difficulty ratings, waivers, headcounts and organizers trained to make the call.'),
        jsonb_build_object('title','Welcoming, not exclusive','body','Beginners are welcome on beginner trips. Everyone earns their way to bigger days.'),
        jsonb_build_object('title','Privacy respected','body','No follower counts, no public phone numbers, no unsolicited DMs.')),
     'stats_override', jsonb_build_object()), 'Homepage copy and imagery');

-- Badges (awarded manually by admins at launch)
insert into public.badges (slug, name, description, icon) values
  ('first-trip','First Trip','Completed a first community activity','sparkles'),
  ('ten-trips','Ten Trips','Completed ten community activities','award'),
  ('reliable','Reliable','Twelve months without a late cancellation or no-show','shield-check'),
  ('trip-leader','Trip Leader','Organized a community activity','flag'),
  ('summit-seeker','Summit Seeker','Completed a strenuous summit hike','mountain');

-- Waiver templates (DRAFT — legal review required)
with t as (
  insert into public.waiver_templates (id, title, kind, description, current_version) values
    ('00000000-0000-4000-b000-000000000001','Community Participation Waiver','general','Signed once by every member; re-signed when terms change.',1),
    ('00000000-0000-4000-b000-000000000002','Paddling Activities Risk Acknowledgement','activity','Kayaking and paddleboarding.',1),
    ('00000000-0000-4000-b000-000000000003','Winter & Alpine Activities Risk Acknowledgement','activity','Snowshoeing, winter hiking and alpine travel.',1)
  returning id
) select 1;

update public.waiver_templates set category_id = (select id from public.activity_categories where slug='kayaking')
  where id = '00000000-0000-4000-b000-000000000002';
update public.waiver_templates set category_id = (select id from public.activity_categories where slug='snowshoeing')
  where id = '00000000-0000-4000-b000-000000000003';

insert into public.waiver_versions (template_id, version, body, change_summary, requires_resign) values
('00000000-0000-4000-b000-000000000001', 1, $w$**DRAFT TEMPLATE — NOT LEGAL ADVICE. This text must be reviewed by a qualified British Columbia lawyer before production use.**

## Release of liability, waiver of claims and assumption of risk

By signing this document I acknowledge that I am voluntarily participating in outdoor activities organized through the community ("Activities"), and that I am at least 18 years old.

> Reviewer note: the age of majority in British Columbia is 19. Confirm how this waiver applies to 18-year-old members before launch.

**1. Inherent risks.** Outdoor activities involve risks including, but not limited to: changing weather, cold, heat, lightning, avalanches, falling rocks or trees, uneven terrain, water hazards, wildlife, getting lost, vehicle travel, equipment failure, the actions of other participants, delayed rescue and medical response in remote areas, and my own physical condition. These risks can cause injury, illness, property loss or death.

**2. My responsibilities.** I will honestly assess my fitness and experience, bring the required equipment, follow organizer instructions, stay with the group or follow agreed regroup procedures, and withdraw if I feel unsafe. I will tell the organizer about any condition that could affect my safety.

**3. Volunteers.** Organizers are volunteers, not professional guides, unless an event explicitly says otherwise.

**4. Release.** To the extent permitted by law, I release and waive all claims against the community, its owner, administrators, organizers and volunteers for loss, damage or injury arising from my participation, including claims arising from negligence.

**5. Medical treatment.** I consent to receiving first aid and emergency medical treatment if needed and accept responsibility for related costs.

**6. Photos.** My photo and media preferences are managed separately in my account.

**7. Governing law.** This agreement is governed by the laws of British Columbia.

I have read and understood this document. I am signing it voluntarily by typing my full legal name.$w$, 'Initial version', true),
('00000000-0000-4000-b000-000000000002', 1, $w$**DRAFT TEMPLATE — NOT LEGAL ADVICE. Legal review required before production use.**

## Paddling activities risk acknowledgement

I understand paddling activities carry specific risks including capsizing, cold-water immersion and cold shock, drowning, currents, tides, wind and waves, boat traffic, and difficulty of rescue.

- I can swim and I am comfortable in deep water.
- I will wear a properly fitted personal flotation device (PFD) **at all times** on the water.
- I will follow the organizer's on-water instructions, stay within the group area and signal if I need help.
- I will disclose any condition that affects my ability to self-rescue.

I accept these risks as part of the Community Participation Waiver.$w$, 'Initial version', true),
('00000000-0000-4000-b000-000000000003', 1, $w$**DRAFT TEMPLATE — NOT LEGAL ADVICE. Legal review required before production use.**

## Winter and alpine activities risk acknowledgement

I understand winter and alpine travel involves risks including avalanches, hypothermia, frostbite, whiteout conditions, cornices, tree wells, early darkness and slower rescue response.

- I will carry the required winter equipment listed for the event (including traction devices, extra layers and a headlamp).
- I understand organizers may change the route or turn the group around at any time for safety reasons.
- Where avalanche terrain may be encountered, I will carry the avalanche safety equipment specified for the event and know how to use it.

I accept these risks as part of the Community Participation Waiver.$w$, 'Initial version', true);

update public.site_settings set value = to_jsonb('00000000-0000-4000-b000-000000000001'::text) where key = 'general_waiver_template_id';

-- FAQ (15 topics required by the brief)
insert into public.faqs (category, question, answer, sort_order, show_on_home) values
('Joining','How do I join?','Create an account with your contact details, an emergency contact and a short introduction. An administrator reviews every new member, usually within two days. Once approved you can apply for activities.',1,true),
('Activities','How do event applications work?','Each activity has an application. You answer a few event-specific questions and confirm your equipment. Organizers select participants after reviewing applications, then selected members sign the waiver, pay if needed, and confirm attendance. Applying does not guarantee a place.',2,true),
('Activities','Why does participation require approval?','Selection keeps groups safe and balanced. Organizers consider experience relative to the difficulty, reliability, equipment readiness, answers to event questions and fair rotation so that more members get a turn. We never select based on appearance or any characteristic protected under the BC Human Rights Code.',3,true),
('Activities','What fitness and experience do I need?','Every event lists the required experience, minimum fitness expectations, distance, elevation gain and expected pace. Choose activities that match what you can comfortably do today — there is always another trip to build up to.',4,false),
('Activities','How are difficulty levels defined?',E'**Easy** – under 8 km, under 300 m gain, well-maintained trails.\n**Moderate** – 8–14 km or 300–800 m gain; steady fitness required.\n**Challenging** – 14–20 km or 800–1,200 m gain; prior hiking experience required.\n**Strenuous** – long days over 1,200 m gain or rough terrain.\n**Expert** – technical terrain, scrambling or winter alpine travel; experience and specialised gear required.',5,false),
('Payments','What payment methods are accepted?','Each event shows which methods are allowed: secure online card payment (processed by Stripe — we never see or store your card number), cash on the day, or no payment for free events. You are only asked to pay after you are selected.',6,false),
('Payments','What is the cancellation and refund policy?','You can cancel from your dashboard. Cancelling before the event''s cancellation deadline is free and paid fees are refunded per the event''s policy. Late cancellations are recorded and may not be refunded. If we cancel an event (including for weather), you receive a full refund.',7,true),
('Attendance','What is the no-show policy?','If you are confirmed and do not attend without cancelling, your booking privileges are paused automatically once an administrator confirms the no-show. You can submit an explanation from your account and we review every one. Emergencies and safety-related withdrawals are not penalised.',8,true),
('Safety','Why do I need to sign waivers?','Waivers explain the risks of each activity and your responsibilities. You sign electronically before your place is confirmed. If the terms change, you will be asked to re-sign.',9,false),
('Safety','What happens in an emergency?','Organizers carry a first-aid kit and have authorised access to participants'' emergency contacts for their events. Call 911 first in any emergency. Organizers take headcounts at key points and confirm everyone has safely completed or left the activity.',10,false),
('Activities','What equipment do I need?','Each event lists required and recommended equipment. For most hikes that means the Ten Essentials: navigation, headlamp, sun protection, first aid, knife, fire starter, emergency shelter, extra food, extra water and extra clothes. Organizers may turn away participants without required gear.',11,false),
('Activities','How does carpooling work?','Confirmed participants can offer or request seats on the event page. Drivers set the number of seats and a general departure area. We recommend riders contribute fairly to fuel costs.',12,false),
('Community','What are the community expectations?','Be on time, be prepared, be kind, leave no trace, and look after each other. Read the full community guidelines and code of conduct before your first trip.',13,false),
('Privacy','How is my personal information handled?','Other members only see your first name, last initial, optional photo, short intro, interests and selected experience. Your phone number, email and emergency contact are never shown to other members. Organizers can view emergency contacts only for confirmed participants of their own events, and every view is logged.',14,false),
('Community','How can I become an event organizer?','After you have attended several activities reliably, let us know through an activity suggestion with "willing to help organize" ticked, or contact the community team. New organizers co-lead with an experienced organizer first.',15,false);

-- Policy pages (DRAFTS — legal review required)
insert into public.policy_pages (slug, title, summary, body, sort_order) values
('community-guidelines','Community Guidelines','How we look after each other and the places we visit.', $p$Our community works because members show up prepared, look out for one another and treat every place we visit with respect.

## Show up
- Only apply for activities you intend to attend and are prepared for.
- Confirm on time, arrive on time, and cancel through your dashboard as early as possible if plans change.

## Be prepared
- Read the full event description, bring all required equipment and enough food and water.
- Be honest about your experience and fitness. Organizers rely on it to keep the group safe.

## Look after each other
- Stay with the group or follow agreed regroup points. Never leave anyone behind.
- Organizers have final say on route, pace, turnaround times and participation.

## Respect the outdoors
- Follow Leave No Trace principles. Pack out everything you bring in.
- Respect closures, private land, wildlife and Indigenous territories. Many of our activities take place on the traditional, ancestral and unceded territories of the Coast Salish peoples, including the xʷməθkʷəy̓əm (Musqueam), Sḵwx̱wú7mesh (Squamish) and səl̓ilwətaɬ (Tsleil-Waututh) Nations.

## Keep it a community, not a dating app
- No unsolicited romantic or sexual advances, no pressure to share contact details.
- Don't share other members' photos or information without their consent.$p$, 1),
('code-of-conduct','Code of Conduct','Behaviour we expect, and what happens when it falls short.', $p$All members, organizers and administrators agree to this code.

## Expected behaviour
- Treat everyone with respect regardless of background, identity, ability, age or experience.
- Communicate kindly and constructively in event discussions.
- Follow organizer safety instructions.

## Unacceptable behaviour
- Harassment, intimidation, discrimination or hate speech.
- Unwanted physical contact, sexual comments or advances.
- Being under the influence of alcohol or drugs during an activity in a way that affects safety.
- Recording or photographing members who have asked not to be photographed.
- Repeated unreliable attendance.

## Enforcement
Depending on severity, administrators may issue a private warning, restrict booking privileges, suspend, or permanently remove a member. Serious safety matters may be reported to the authorities. Decisions are communicated privately; members can appeal through their account.$p$, 2),
('privacy-policy','Privacy Policy','What we collect, why, and how we protect it.', $p$**DRAFT — must be reviewed for compliance with BC's Personal Information Protection Act (PIPA) and, where applicable, PIPEDA before launch.**

## What we collect
- **Account information:** name, email, phone number, emergency contact, a short introduction.
- **Optional profile information:** interests, general city, experience, fitness self-assessment, availability, languages, vehicle access and carpool preferences, skills and certifications, profile photo.
- **Activity records:** applications, answers to event questions, attendance, waiver signatures (with time, IP address and device information), payments (processed by Stripe — we never store card numbers).

## Why we collect it
To operate the community: review membership, select participants, keep groups safe, contact you about activities, reach your emergency contact if needed, process payments and maintain required records.

## Who can see it
- **Other members:** first name, last initial, optional photo, intro, interests, selected experience, completed-activity count, membership duration and badges.
- **Organizers:** your application and, for events you are confirmed for, your emergency contact (every access is logged).
- **Administrators:** your full account for membership and safety administration.
- **Service providers:** Supabase (database hosting), Stripe (payments), Resend (email) and Vercel (hosting), under their own privacy terms. Data may be stored outside Canada.

## Retention
We keep records only as long as needed. Waiver and payment records are retained for legal and accounting purposes even after account deletion, detached from your contact information. Retention periods are set by the owner and listed in the admin settings.

## Your choices
You can update your profile, download your data and delete your account at any time from your account page. Contact us for any privacy question.$p$, 3),
('terms-of-use','Terms of Use','The rules for using this website.', $p$**DRAFT — legal review required.**

1. You must be at least 18 years old to create an account.
2. You are responsible for the accuracy of the information you provide.
3. Membership and participation are at the discretion of the administrators, applied consistently with our published policies.
4. You may not use the platform to advertise, solicit, harass or collect other members' information.
5. Activities are organized by volunteers and involve inherent risks described in the waivers.
6. We may update these terms; material changes will be announced and may require re-acceptance.
7. These terms are governed by the laws of British Columbia.$p$, 4),
('cancellation-refund-policy','Cancellation & Refund Policy','How cancellations and refunds work.', $p$**DRAFT — review before launch.**

## If you cancel
- Cancel from your dashboard as early as possible so someone on the waitlist can take your place.
- **Before the event's cancellation deadline** (shown on every event; default 48 hours before start): no penalty. Paid fees are refunded unless the event says otherwise.
- **After the deadline:** recorded as a late cancellation. Fees and deposits may not be refunded.
- **Safety or emergency withdrawals** are never penalised. Let your organizer know.

## If we cancel
If an event is cancelled by organizers — including for weather or unsafe conditions — you receive a full refund of any fee or deposit, and it never counts against you.

## Refund method
Online payments are refunded to the original card (5–10 business days). Cash payments are refunded in cash or by e-transfer.$p$, 5),
('attendance-policy','Attendance Policy','Why reliability matters and how no-shows are handled.', $p$Small groups depend on every confirmed member. A no-show can mean a waitlisted member missed out, carpools fall apart or a group goes out short of an experienced member.

## Outcomes we record
- **Attended**
- **Cancelled within the permitted period** – no effect on your standing
- **Late cancellation** – recorded; repeated late cancellations may affect future selection
- **Excused absence** – emergencies, illness and safety withdrawals
- **Unexcused no-show** – confirmed, did not attend, did not cancel

## What happens after a no-show
When an administrator confirms an unexcused no-show, your ability to apply for new activities is paused automatically. You can submit an explanation from your account standing page. An administrator reviews it and can restore your privileges, sometimes with a reminder of this policy. Repeated no-shows may lead to suspension.

Events cancelled by organizers, organizer mistakes and legitimate emergencies never count against you.

## Selection fairness
Selection uses activity-related criteria only: experience for the difficulty, attendance reliability, equipment readiness, answers to event questions, group balance for safety and fair rotation.$p$, 6),
('outdoor-safety-policy','Outdoor Safety Policy','Our safety standards for every activity.', $p$- Every event has a difficulty rating, turnaround time guidance and required equipment list.
- Organizers check weather, avalanche (avalanche.ca) and trail conditions before departure and may postpone, alter or cancel.
- Organizers carry a first-aid kit and a means of emergency communication where coverage is limited.
- A trip plan is left with a responsible person (see AdventureSmart.ca).
- Headcounts are taken at the start, at key points and at the finish; organizers confirm each participant has safely completed or departed.
- Participants may not continue beyond an organizer's turnaround decision.
- Incidents are recorded and reviewed by administrators.
- In an emergency, call 911. Search and rescue in BC is free to the public — call early.$p$, 7),
('harassment-reporting','Harassment & Misconduct Reporting','How to report a concern privately.', $p$If something made you feel unsafe or uncomfortable, please tell us. You can report:
- From any event page or discussion post using **Report**
- Through the private **Report a concern** form in your account

Reports are visible only to moderators and administrators. We never reveal who made a report to the member being reported. We will acknowledge your report, look into it, and take action consistent with the Code of Conduct.

**If you are in immediate danger, call 911.**$p$, 8),
('photo-media-consent','Photo & Media Consent','How photos are taken and shared.', $p$- You choose in your account whether you consent to appearing in community photos shared on the website.
- Organizers will ask the group before taking group photos. Tell your organizer if you prefer not to be photographed.
- Highlights are published only after an administrator confirms everyone pictured has consented.
- You can ask us to remove any photo of you at any time.$p$, 9);
