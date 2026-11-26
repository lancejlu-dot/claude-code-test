"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { getStripe } from "../stripe";
import { isStripeConfigured } from "../env";
import { localInputToIso } from "../time";
import { bool, dbError, guardDemo, lines, num, optStr, str } from "./helpers";
import type { ActionResult } from "@/components/forms";
import type { ApplicationQuestion, CustomSection, LinkItem } from "../types";

// All state-changing admin operations call database functions that re-check the caller's role.
// RLS also restricts the direct table writes used for event content and site content.

const ok = (message: string, paths: string[] = []): ActionResult => { paths.forEach((p) => revalidatePath(p, "layout")); return { ok: true, message }; };
async function rpc(fn: string, args: Record<string, unknown>) {
  const sb = await createClient();
  return sb.rpc(fn, args);
}

/* ----------------------------- Events ----------------------------- */

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

function parseLinks(text: string): LinkItem[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [label, url] = l.includes("|") ? l.split("|").map((x) => x.trim()) : [l, l];
    return { label, url };
  }).filter((l) => /^https?:\/\//.test(l.url));
}
function parseSections(text: string): CustomSection[] {
  // "## Title" lines start a section; following "- item" lines are bullets.
  const out: CustomSection[] = [];
  for (const raw of text.split("\n")) {
    const l = raw.trim(); if (!l) continue;
    if (l.startsWith("#")) out.push({ title: l.replace(/^#+\s*/, ""), items: [] });
    else if (out.length) out[out.length - 1].items.push(l.replace(/^[-*]\s*/, ""));
  }
  return out.filter((s) => s.title);
}
function parseQuestions(text: string): ApplicationQuestion[] {
  // One per line: "Question text" — prefix "*" for required, suffix "(yes/no)" for yes/no answers.
  return text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10).map((l, i) => {
    const required = l.startsWith("*");
    const yesno = /\(yes\/no\)\s*$/i.test(l);
    const label = l.replace(/^\*\s*/, "").replace(/\(yes\/no\)\s*$/i, "").trim();
    return { id: `q${i + 1}_${slugify(label).slice(0, 20)}`, label, required, type: yesno ? "yesno" : "text" };
  });
}

export async function saveEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const id = optStr(fd, "id");
  const title = str(fd, "title");
  const startsAt = localInputToIso(str(fd, "starts_at"));
  if (!title) return { ok: false, error: "Title is required." };
  if (!startsAt) return { ok: false, error: "Start date and time are required." };
  const max = num(fd, "max_participants");
  if (!max || max < 1) return { ok: false, error: "Maximum participants must be at least 1." };
  const methods = fd.getAll("payment_methods").map(String);
  const price = Math.round((num(fd, "price") ?? 0) * 100);
  const deposit = Math.round((num(fd, "deposit") ?? 0) * 100);

  const row = {
    title, slug: str(fd, "slug") ? slugify(str(fd, "slug")) : slugify(title),
    category_id: str(fd, "category_id"), region_id: optStr(fd, "region_id"), featured: bool(fd, "featured"),
    cover_image_url: optStr(fd, "cover_image_url"), gallery_urls: lines(fd, "gallery_urls"),
    summary: optStr(fd, "summary"), description: str(fd, "description"),
    starts_at: startsAt, ends_at: localInputToIso(str(fd, "ends_at")), general_location: optStr(fd, "general_location"),
    distance_km: num(fd, "distance_km"), elevation_gain_m: num(fd, "elevation_gain_m"), duration_minutes: num(fd, "duration_minutes"),
    difficulty: optStr(fd, "difficulty"), group_pace: optStr(fd, "group_pace"),
    required_experience: str(fd, "required_experience") || "none", experience_notes: optStr(fd, "experience_notes"),
    fitness_expectations: optStr(fd, "fitness_expectations"),
    required_equipment: lines(fd, "required_equipment"), recommended_equipment: lines(fd, "recommended_equipment"),
    food_water: optStr(fd, "food_water"), transportation: optStr(fd, "transportation"), carpool_enabled: bool(fd, "carpool_enabled"),
    weather_considerations: optStr(fd, "weather_considerations"), safety_information: optStr(fd, "safety_information"),
    max_participants: max, reserved_spots: num(fd, "reserved_spots") ?? 0,
    registration_opens_at: localInputToIso(str(fd, "registration_opens_at")), registration_deadline: localInputToIso(str(fd, "registration_deadline")),
    cancellation_deadline: localInputToIso(str(fd, "cancellation_deadline")), confirmation_hours: num(fd, "confirmation_hours"),
    waitlist_enabled: bool(fd, "waitlist_enabled"), waitlist_mode: str(fd, "waitlist_mode") || "manual", waitlist_offer_hours: num(fd, "waitlist_offer_hours") ?? 24,
    price_cents: price, deposit_cents: deposit,
    payment_methods: price > 0 || deposit > 0 ? (methods.length ? methods : ["online"]) : ["none"],
    payment_deadline: localInputToIso(str(fd, "payment_deadline")), cancellation_policy: optStr(fd, "cancellation_policy"),
    external_links: parseLinks(str(fd, "external_links")), custom_sections: parseSections(str(fd, "custom_sections")),
    application_questions: parseQuestions(str(fd, "application_questions")),
    hidden_fields: fd.getAll("hidden_fields").map(String), restrict_logistics: bool(fd, "restrict_logistics"),
  };
  let eventId = id;
  if (id) {
    const { error } = await sb.from("events").update(row).eq("id", id);
    if (error) return dbError(error, error.code === "23505" ? "That URL slug is already used by another event." : undefined);
  } else {
    const { data, error } = await sb.from("events").insert({ ...row, status: "draft" }).select("id").single();
    if (error) return dbError(error, error.code === "23505" ? "That URL slug is already used by another event." : undefined);
    eventId = data.id;
  }
  const priv = {
    event_id: eventId, meeting_location: optStr(fd, "meeting_location"), meeting_location_url: optStr(fd, "meeting_location_url"),
    meeting_time_note: optStr(fd, "meeting_time_note"), parking_information: optStr(fd, "parking_information"),
    carpool_details: optStr(fd, "carpool_details"), additional_instructions: optStr(fd, "additional_instructions"),
  };
  const { error: pe } = await sb.from("event_private_details").upsert(priv);
  if (pe) return dbError(pe);

  // Waivers (event staff) and organizers (admins only — RLS enforces).
  const waivers = fd.getAll("waivers").map(String);
  await sb.from("event_waivers").delete().eq("event_id", eventId!);
  if (waivers.length) await sb.from("event_waivers").insert(waivers.map((t) => ({ event_id: eventId, template_id: t })));
  if (fd.has("organizers_present")) {
    const orgs = fd.getAll("organizers").map(String);
    const lead = str(fd, "lead_organizer");
    const { error: oe } = await sb.from("event_organizers").delete().eq("event_id", eventId!);
    if (!oe && orgs.length) await sb.from("event_organizers").insert(orgs.map((u) => ({ event_id: eventId, user_id: u, is_lead: u === lead })));
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/events/${eventId}?created=1`);
  return { ok: true, message: "Event saved." };
}

export async function eventLifecycle(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const id = str(fd, "event_id"); const op = str(fd, "op"); const note = optStr(fd, "note");
  const calls: Record<string, [string, Record<string, unknown>, string]> = {
    publish: ["publish_event", { p_event: id }, "Published — the event is now visible to members."],
    postpone: ["postpone_event", { p_event: id, p_note: note }, "Postponed. Applicants have been notified."],
    cancel: ["cancel_event", { p_event: id, p_note: note, p_weather: bool(fd, "weather") }, "Cancelled. Everyone has been notified; nobody is penalised."],
    complete: ["complete_event", { p_event: id }, "Marked as completed."],
    open: ["set_registration_open", { p_event: id, p_open: true }, "Registration reopened."],
    close: ["set_registration_open", { p_event: id, p_open: false }, "Registration closed."],
  };
  if (op === "duplicate") {
    const { data, error } = await rpc("duplicate_event", { p_event: id });
    if (error) return dbError(error);
    redirect(`/admin/events/${data}?duplicated=1`);
  }
  if (op === "delete") {
    const { error } = await rpc("delete_event", { p_event: id });
    if (error) return dbError(error);
    redirect("/admin/events?deleted=1");
  }
  const c = calls[op]; if (!c) return { ok: false, error: "Unknown action." };
  const { error } = await rpc(c[0], c[1]);
  if (error) return dbError(error);
  return ok(c[2], ["/"]);
}

export async function uploadEventImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const file = fd.get("image");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose an image." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Images must be under 10 MB." };
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return { ok: false, error: "Use JPG, PNG, WebP or AVIF." };
  const sb = await createClient();
  const path = `events/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "photo"}.${file.type.split("/")[1]}`;
  const { error } = await sb.storage.from("event-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return { ok: false, error: error.message };
  const url = sb.storage.from("event-media").getPublicUrl(path).data.publicUrl;
  return { ok: true, message: `Uploaded. Image URL: ${url}` };
}

/* --------------------------- Applications -------------------------- */

export async function reviewApplications(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const ids = fd.getAll("ids").map(String);
  const action = str(fd, "action");
  if (!ids.length) return { ok: false, error: "Select at least one applicant." };
  const { data, error } = await rpc("review_applications", {
    p_ids: ids, p_action: action, p_message: optStr(fd, "message"), p_confirm_by: localInputToIso(str(fd, "confirm_by")),
  });
  if (error) return dbError(error);
  return ok(`${data} application${data === 1 ? "" : "s"} updated.`, ["/admin"]);
}

export async function inviteMember(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("invite_member", { p_event: str(fd, "event_id"), p_user: str(fd, "user_id"), p_message: optStr(fd, "message") });
  if (error) return dbError(error);
  return ok("Invitation sent.", ["/admin"]);
}

export async function offerSpot(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("offer_spot", { p_application: str(fd, "application_id") });
  if (error) return dbError(error);
  return ok("Offer sent to the waitlisted member.", ["/admin"]);
}

/** Button-level variant (inside the batch review form). */
export async function offerSpotDirect(fd: FormData) {
  if (guardDemo()) return;
  await rpc("offer_spot", { p_application: str(fd, "application_id") });
  revalidatePath("/admin", "layout");
}

/* ---------------------------- Event day ---------------------------- */

export async function recordAttendance(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("record_attendance", { p_application: str(fd, "application_id"), p_outcome: str(fd, "outcome"), p_note: optStr(fd, "note") });
  if (error) return dbError(error);
  return ok("Attendance recorded.", ["/admin"]);
}

export async function setCheckIn(fd: FormData) {
  if (guardDemo()) return;
  await rpc("set_check_in", { p_application: str(fd, "application_id"), p_checked: str(fd, "checked") === "true" });
  revalidatePath(str(fd, "path"));
}

export async function markDeparted(fd: FormData) {
  if (guardDemo()) return;
  await rpc("mark_departed_safely", { p_application: str(fd, "application_id"), p_departed: str(fd, "departed") === "true" });
  revalidatePath(str(fd, "path"));
}

export async function confirmNoShow(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("confirm_no_show", { p_application: str(fd, "application_id") });
  if (error) return dbError(error);
  return ok("No-show confirmed. The member's booking privileges are now restricted and they've been notified.", ["/admin"]);
}

export async function recordHeadcount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const counted = num(fd, "counted"); const expected = num(fd, "expected");
  if (counted == null || expected == null) return { ok: false, error: "Enter the count." };
  const { error } = await sb.from("headcounts").insert({ event_id: str(fd, "event_id"), label: str(fd, "label") || "Headcount", counted, expected, notes: optStr(fd, "notes"), recorded_by: c?.claims?.sub });
  if (error) return dbError(error);
  return ok(counted === expected ? `Headcount recorded: all ${counted} accounted for.` : `Headcount recorded: ${counted} of ${expected}. Follow up on missing participants now.`, ["/admin"]);
}

export async function recordIncident(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  if (!str(fd, "summary")) return { ok: false, error: "Add a short summary." };
  const { error } = await sb.from("incidents").insert({
    event_id: str(fd, "event_id"), severity: str(fd, "severity") || "minor", summary: str(fd, "summary"), details: optStr(fd, "details"),
    actions_taken: optStr(fd, "actions_taken"), emergency_services_contacted: bool(fd, "emergency_services_contacted"),
    follow_up_required: bool(fd, "follow_up_required"), occurred_at: localInputToIso(str(fd, "occurred_at")) ?? new Date().toISOString(), recorded_by: c?.claims?.sub,
  });
  if (error) return dbError(error);
  return ok("Incident recorded. Administrators can review it in the incident log.", ["/admin"]);
}

export async function resolveIncident(fd: FormData) {
  if (guardDemo()) return;
  const sb = await createClient();
  await sb.from("incidents").update({ resolved: str(fd, "resolved") === "true" }).eq("id", str(fd, "incident_id"));
  revalidatePath("/admin/incidents");
}

/* ----------------------------- Payments ---------------------------- */

export async function recordCash(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const amount = Math.round((num(fd, "amount") ?? 0) * 100);
  const { error } = await rpc("record_cash_payment", { p_application: str(fd, "application_id"), p_amount_cents: amount, p_notes: optStr(fd, "notes"), p_kind: str(fd, "kind") || "fee" });
  if (error) return dbError(error);
  return ok("Cash payment recorded and receipt issued.", ["/admin"]);
}

export async function waivePayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("waive_payment", { p_application: str(fd, "application_id"), p_reason: str(fd, "reason") || "Waived by admin", p_kind: str(fd, "kind") || "fee" });
  if (error) return dbError(error);
  return ok("Payment waived.", ["/admin"]);
}

export async function refundPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const paymentId = str(fd, "payment_id");
  const amount = Math.round((num(fd, "amount") ?? 0) * 100);
  if (amount <= 0) return { ok: false, error: "Enter a refund amount." };
  const { data: p } = await sb.from("payments").select("id,method,stripe_payment_intent_id,amount_cents,refunded_cents").eq("id", paymentId).maybeSingle();
  if (!p) return { ok: false, error: "Payment not found (administrator access required)." };
  if (amount > p.amount_cents - p.refunded_cents) return { ok: false, error: "Refund exceeds the remaining paid amount." };
  let stripeRefundId: string | null = null;
  if (p.method === "online") {
    if (!isStripeConfigured()) return { ok: false, error: "Stripe is not configured, so online payments can't be refunded from here." };
    if (!p.stripe_payment_intent_id) return { ok: false, error: "This payment has no Stripe payment reference." };
    const r = await getStripe().refunds.create({ payment_intent: p.stripe_payment_intent_id, amount, metadata: { payment_id: p.id } });
    stripeRefundId = r.id;
  }
  const { error } = await rpc("record_refund", { p_payment: paymentId, p_amount_cents: amount, p_reason: optStr(fd, "reason"), p_stripe_refund_id: stripeRefundId });
  if (error) return dbError(error);
  return ok(p.method === "online" ? "Refund issued through Stripe." : "Refund recorded. Remember to return the cash or send an e-transfer.", ["/admin"]);
}

/* ----------------------------- Members ----------------------------- */

export async function setMemberStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const days = num(fd, "days");
  const { error } = await rpc("set_member_status", {
    p_user: str(fd, "user_id"), p_status: str(fd, "status"), p_member_message: optStr(fd, "member_message"),
    p_internal_note: optStr(fd, "internal_note"), p_until: days ? new Date(Date.now() + days * 86400_000).toISOString() : null,
  });
  if (error) return dbError(error);
  return ok("Membership status updated and the member has been notified.", ["/admin"]);
}

export async function quickApprove(fd: FormData) {
  if (guardDemo()) return;
  await rpc("set_member_status", { p_user: str(fd, "user_id"), p_status: "active", p_member_message: null, p_internal_note: null, p_until: null });
  revalidatePath("/admin", "layout");
}

export async function issueWarning(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  if (str(fd, "message").length < 10) return { ok: false, error: "Write a short message for the member." };
  const { error } = await rpc("issue_warning", { p_user: str(fd, "user_id"), p_message: str(fd, "message"), p_event: optStr(fd, "event_id") });
  if (error) return dbError(error);
  return ok("Warning sent privately to the member.", ["/admin"]);
}

export async function addNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  if (!str(fd, "body")) return { ok: false, error: "Write a note." };
  const { error } = await rpc("add_admin_note", { p_user: str(fd, "user_id"), p_body: str(fd, "body"), p_event: null });
  if (error) return dbError(error);
  return ok("Confidential note saved.", ["/admin"]);
}

export async function setStaffRole(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("set_staff_role", { p_user: str(fd, "user_id"), p_role: str(fd, "role"), p_grant: str(fd, "grant") === "true" });
  if (error) return dbError(error);
  return ok("Roles updated.", ["/admin"]);
}

export async function awardBadge(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const { error } = await sb.from("member_badges").upsert({ user_id: str(fd, "user_id"), badge_id: str(fd, "badge_id"), awarded_by: c?.claims?.sub });
  if (error) return dbError(error);
  return ok("Badge awarded.", ["/admin"]);
}

export async function setGroupMembership(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const user = str(fd, "user_id"); const groups = fd.getAll("groups").map(String);
  await sb.from("member_group_members").delete().eq("user_id", user);
  if (groups.length) {
    const { error } = await sb.from("member_group_members").insert(groups.map((g) => ({ group_id: g, user_id: user })));
    if (error) return dbError(error);
  }
  return ok("Groups updated.", ["/admin"]);
}

/* ------------------------------ Appeals ---------------------------- */

export async function decideAppeal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const approve = str(fd, "decision") === "approve";
  const { error } = await rpc("decide_appeal", { p_appeal: str(fd, "appeal_id"), p_approve: approve, p_message: optStr(fd, "message"), p_restore: approve });
  if (error) return dbError(error);
  return ok(approve ? "Appeal approved; booking privileges restored." : "Appeal declined; the member has been notified.", ["/admin"]);
}

/* ------------------------------ Waivers ---------------------------- */

export async function createWaiverTemplate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data, error } = await sb.from("waiver_templates").insert({
    title: str(fd, "title"), kind: str(fd, "kind") || "activity", category_id: optStr(fd, "category_id"), description: optStr(fd, "description"),
  }).select("id").single();
  if (error) return dbError(error);
  const { error: e2 } = await rpc("publish_waiver_version", { p_template: data.id, p_body: str(fd, "body"), p_summary: "Initial version", p_requires_resign: true });
  if (e2) return dbError(e2);
  redirect(`/admin/waivers/${data.id}`);
}

export async function publishWaiverVersion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  if (str(fd, "body").length < 50) return { ok: false, error: "The waiver text looks too short." };
  const { data, error } = await rpc("publish_waiver_version", {
    p_template: str(fd, "template_id"), p_body: str(fd, "body"), p_summary: str(fd, "summary") || "Updated", p_requires_resign: bool(fd, "requires_resign"),
  });
  if (error) return dbError(error);
  return ok(`Version ${data} published${bool(fd, "requires_resign") ? " — members must re-sign before their next confirmation" : ""}. Legal review status was reset.`, ["/admin/waivers"]);
}

export async function setWaiverReviewed(fd: FormData) {
  if (guardDemo()) return;
  const sb = await createClient();
  const reviewed = str(fd, "reviewed") === "true";
  await sb.from("waiver_templates").update({ legal_reviewed: reviewed, legal_reviewed_at: reviewed ? new Date().toISOString() : null }).eq("id", str(fd, "template_id"));
  revalidatePath("/admin/waivers", "layout");
}

/* --------------------------- Communication ------------------------- */

export async function sendAnnouncement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const title = str(fd, "title"); const body = str(fd, "body");
  if (!title || !body) return { ok: false, error: "Add a subject and message." };
  const { data, error } = await rpc("send_announcement", {
    p_audience: str(fd, "audience"), p_title: title, p_body: body, p_event: optStr(fd, "event_id"), p_group: optStr(fd, "group_id"), p_user: optStr(fd, "user_id"),
  });
  if (error) return dbError(error);
  return ok(`Sent to ${data} member${data === 1 ? "" : "s"} (in-app${" + email queue"}).`, ["/admin"]);
}

/* ---------------------------- Suggestions -------------------------- */

export async function respondSuggestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { error } = await sb.from("suggestions").update({ status: str(fd, "status"), admin_response: optStr(fd, "admin_response") }).eq("id", str(fd, "suggestion_id"));
  if (error) return dbError(error);
  return ok("Suggestion updated.", ["/admin/suggestions", "/suggestions"]);
}

export async function convertSuggestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { data, error } = await rpc("convert_suggestion_to_event", { p_suggestion: str(fd, "suggestion_id") });
  if (error) return dbError(error);
  redirect(`/admin/events/${data}?from_suggestion=1`);
}

/* ---------------------------- Moderation --------------------------- */

export async function resolveReport(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { error } = await rpc("resolve_report", { p_report: str(fd, "report_id"), p_status: str(fd, "status"), p_note: optStr(fd, "note") });
  if (error) return dbError(error);
  return ok("Report updated.", ["/admin/moderation"]);
}

/* ------------------------------ Content ---------------------------- */

export async function saveFaq(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const row = { category: str(fd, "category") || "General", question: str(fd, "question"), answer: str(fd, "answer"),
    sort_order: num(fd, "sort_order") ?? 0, published: bool(fd, "published"), show_on_home: bool(fd, "show_on_home") };
  if (!row.question || !row.answer) return { ok: false, error: "Question and answer are required." };
  const id = optStr(fd, "id");
  const { error } = id ? await sb.from("faqs").update(row).eq("id", id) : await sb.from("faqs").insert(row);
  if (error) return dbError(error);
  return ok(id ? "FAQ updated." : "FAQ added.", ["/"]);
}

export async function deleteFaq(fd: FormData) {
  if (guardDemo()) return;
  const sb = await createClient();
  await sb.from("faqs").delete().eq("id", str(fd, "id"));
  revalidatePath("/", "layout");
}

export async function savePolicy(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const { error } = await sb.from("policy_pages").update({
    title: str(fd, "title"), summary: optStr(fd, "summary"), body: str(fd, "body"), published: bool(fd, "published"),
    legal_reviewed: bool(fd, "legal_reviewed"), updated_by: c?.claims?.sub,
  }).eq("slug", str(fd, "slug"));
  if (error) return dbError(error);
  return ok("Policy saved.", ["/"]);
}

export async function saveHighlight(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const consent = bool(fd, "consent_confirmed");
  const publish = bool(fd, "published");
  if (publish && !consent) return { ok: false, error: "Confirm that everyone pictured has consented before publishing." };
  const { error } = await sb.from("highlights").insert({ title: str(fd, "title"), caption: optStr(fd, "caption"), image_url: str(fd, "image_url"),
    event_id: optStr(fd, "event_id"), consent_confirmed: consent, published: publish });
  if (error) return dbError(error);
  return ok("Highlight saved.", ["/"]);
}

export async function deleteHighlight(fd: FormData) {
  if (guardDemo()) return;
  const sb = await createClient();
  await sb.from("highlights").delete().eq("id", str(fd, "id"));
  revalidatePath("/", "layout");
}

export async function saveSetting(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const key = str(fd, "key");
  let value: unknown;
  try { value = JSON.parse(str(fd, "value")); } catch { return { ok: false, error: "That value isn't valid JSON." }; }
  const { data, error } = await sb.from("site_settings").update({ value }).eq("key", key).select("key");
  if (error) return dbError(error);
  if (!data?.length) return { ok: false, error: "Only the owner can change this setting." };
  return ok("Setting saved.", ["/"]);
}

export async function saveHomepage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: cur } = await sb.from("site_settings").select("value").eq("key", "homepage").single();
  const values = [0, 1, 2, 3].map((i) => ({ title: str(fd, `value_title_${i}`), body: str(fd, `value_body_${i}`) })).filter((v) => v.title);
  const override: Record<string, number> = {};
  for (const k of ["members", "events_completed", "participations", "km_travelled"]) { const n = num(fd, `stat_${k}`); if (n != null) override[k] = n; }
  const value = { ...(cur?.value ?? {}), hero_title: str(fd, "hero_title"), hero_subtitle: str(fd, "hero_subtitle"),
    hero_image_url: str(fd, "hero_image_url") || "/images/hero.svg", values, stats_override: override };
  const { error } = await sb.from("site_settings").update({ value }).eq("key", "homepage");
  if (error) return dbError(error);
  return ok("Homepage updated.", ["/"]);
}

export async function saveBrand(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const value = { name: str(fd, "name"), tagline: str(fd, "tagline"), region_label: str(fd, "region_label"), contact_email: str(fd, "contact_email") };
  if (!value.name) return { ok: false, error: "Community name is required." };
  const { error } = await sb.from("site_settings").update({ value }).eq("key", "brand");
  if (error) return dbError(error);
  return ok("Brand updated.", ["/"]);
}

export async function saveRegion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Name is required." };
  const id = optStr(fd, "id");
  const row = { name, slug: slugify(str(fd, "slug") || name), kind: str(fd, "kind") || "area", parent_id: optStr(fd, "parent_id"),
    active: bool(fd, "active"), sort_order: num(fd, "sort_order") ?? 0, time_zone: str(fd, "time_zone") || "America/Vancouver", currency: str(fd, "currency") || "CAD" };
  const { error } = id ? await sb.from("regions").update(row).eq("id", id) : await sb.from("regions").insert(row);
  if (error) return dbError(error, "Only the owner can change regions (and slugs must be unique).");
  return ok("Region saved.", ["/"]);
}

export async function saveCategory(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Name is required." };
  const id = optStr(fd, "id");
  const row = { name, slug: slugify(str(fd, "slug") || name), icon: str(fd, "icon") || "mountain", description: optStr(fd, "description"),
    hidden_fields: fd.getAll("hidden_fields").map(String), tracks_distance: bool(fd, "tracks_distance"), active: bool(fd, "active"), sort_order: num(fd, "sort_order") ?? 0 };
  const { error } = id ? await sb.from("activity_categories").update(row).eq("id", id) : await sb.from("activity_categories").insert(row);
  if (error) return dbError(error, "Only the owner can change categories (and slugs must be unique).");
  return ok("Category saved.", ["/"]);
}

export async function saveGroup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { error } = await sb.from("member_groups").insert({ name: str(fd, "name"), description: optStr(fd, "description") });
  if (error) return dbError(error);
  return ok("Group created.", ["/admin"]);
}
