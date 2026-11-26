"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "../supabase/server";
import { getStripe } from "../stripe";
import { isStripeConfigured, siteUrl } from "../env";
import { dbError, guardDemo, num, optStr, str, bool } from "./helpers";
import type { ActionResult } from "@/components/forms";

export async function applyToEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const eventId = str(fd, "event_id");
  const answers: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("q_") && typeof v === "string") answers[k.slice(2)] = v.trim();
  const { error } = await sb.rpc("apply_to_event", {
    p_event: eventId, p_answers: answers, p_equipment: fd.getAll("equipment").map(String),
    p_note: optStr(fd, "note"), p_experience: optStr(fd, "experience"),
    p_wants_carpool: fd.get("wants_carpool") ? fd.get("wants_carpool") === "yes" : null, p_can_drive_seats: num(fd, "can_drive_seats"),
  });
  if (error) return dbError(error);
  revalidatePath("/dashboard");
  return { ok: true, message: "Application submitted! We'll notify you as soon as organizers have reviewed it.", redirectTo: "/dashboard/activities?applied=1" };
}

export async function cancelApplication(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data, error } = await sb.rpc("cancel_my_application", {
    p_application: str(fd, "application_id"), p_reason: optStr(fd, "reason"), p_safety_or_emergency: bool(fd, "emergency"),
  });
  if (error) return dbError(error);
  revalidatePath("/dashboard", "layout");
  const msg: Record<string, string> = {
    cancelled_in_period: "Cancelled — thanks for letting us know in time.",
    late_cancellation: "Cancelled. This was after the cancellation deadline, so it's recorded as a late cancellation.",
    excused_absence: "Cancelled and recorded as an excused withdrawal. Take care!",
    withdrawn: "Your application has been withdrawn.",
  };
  return { ok: true, message: msg[String(data)] ?? "Cancelled." };
}

export async function respondToOffer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const accept = str(fd, "accept") === "yes";
  const { error } = await sb.rpc("respond_to_offer", { p_application: str(fd, "application_id"), p_accept: accept });
  if (error) return dbError(error);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: accept ? "Place accepted! Complete the remaining steps to confirm." : "Offer declined. Thanks for letting us know." };
}

export async function confirmParticipation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const choice = str(fd, "payment_choice");
  const { error } = await sb.rpc("confirm_participation", {
    p_application: str(fd, "application_id"), p_payment_choice: choice === "cash" ? "cash" : null,
  });
  if (error) return dbError(error);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "You're confirmed! The participant page is now unlocked." };
}

export async function signWaiver(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  if (!bool(fd, "agree")) return { ok: false, error: "Please tick the box to confirm you have read and agree to the waiver." };
  const sb = await createClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const { error } = await sb.rpc("sign_waiver", {
    p_template: str(fd, "template_id"), p_signature_name: str(fd, "signature_name"), p_event: optStr(fd, "event_id"),
    p_ip: /^[\d.:a-fA-F]+$/.test(ip) ? ip : "", p_user_agent: h.get("user-agent") ?? "",
  });
  if (error) return dbError(error);
  revalidatePath("/waivers", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Signed. A copy is available in your dashboard." };
}

/** Creates a Stripe Checkout session. Members are never charged before approval (enforced in register_checkout_session). */
export async function startCheckout(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  if (!isStripeConfigured()) return { ok: false, error: "Online payments aren't set up yet. Please choose cash if offered, or contact the organizers." };
  const sb = await createClient();
  const appId = str(fd, "application_id");
  const kind = str(fd, "kind") === "deposit" ? "deposit" : "fee";
  const { data: app } = await sb.from("applications").select("id,status,event_id,events(title,slug,price_cents,deposit_cents,currency)").eq("id", appId).maybeSingle();
  if (!app) return { ok: false, error: "Application not found." };
  const ev = app.events as unknown as { title: string; slug: string; price_cents: number; deposit_cents: number; currency: string };
  if (!["approved", "confirmed"].includes(app.status)) return { ok: false, error: "Payment is only requested after your application is approved." };
  const amount = kind === "deposit" ? ev.deposit_cents : ev.price_cents;
  const { data: claims } = await sb.auth.getClaims();

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: (claims?.claims?.email as string) ?? undefined,
    line_items: [{ quantity: 1, price_data: { currency: ev.currency.toLowerCase(), unit_amount: amount,
      product_data: { name: `${ev.title}${kind === "deposit" ? " — deposit" : ""}` } } }],
    metadata: { application_id: appId, kind },
    payment_intent_data: { metadata: { application_id: appId, kind } },
    success_url: `${siteUrl}/dashboard/payments?paid=1`,
    cancel_url: `${siteUrl}/dashboard/activities?payment=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  const { error } = await sb.rpc("register_checkout_session", { p_application: appId, p_kind: kind, p_session_id: session.id });
  if (error) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return dbError(error);
  }
  return { ok: true, message: "Redirecting to secure payment…", redirectTo: session.url ?? "/dashboard/payments" };
}

export async function markNotificationsRead(): Promise<void> {
  if (guardDemo()) return;
  const sb = await createClient();
  await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}

const PROFILE_FIELDS = ["first_name", "intro", "city", "hiking_experience", "experience_summary", "preferred_difficulty",
  "fitness_self_assessment", "preferred_pace"] as const;

export async function updateProfile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const uid = c?.claims?.sub; if (!uid) return { ok: false, error: "Please sign in again." };
  const patch: Record<string, unknown> = {};
  for (const k of PROFILE_FIELDS) patch[k] = optStr(fd, k);
  if (!patch.first_name) return { ok: false, error: "First name is required." };
  if (!patch.intro || String(patch.intro).length < 20) return { ok: false, error: "Your introduction should be at least 20 characters." };
  const list = (k: string) => str(fd, k).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
  Object.assign(patch, {
    interests: fd.getAll("interests").map(String), weekend_availability: fd.getAll("weekend_availability").map(String),
    languages: list("languages"), skills_certifications: list("skills_certifications"),
    has_vehicle: fd.get("has_vehicle") ? fd.get("has_vehicle") === "yes" : null,
    willing_to_carpool: fd.get("willing_to_carpool") ? fd.get("willing_to_carpool") === "yes" : null,
    home_region_id: optStr(fd, "home_region_id"), show_experience: bool(fd, "show_experience"),
    email_notifications: bool(fd, "email_notifications"), photo_consent: bool(fd, "photo_consent"),
  });
  const { error } = await sb.from("profiles").update(patch).eq("id", uid);
  if (error) return dbError(error);
  const { error: e2 } = await sb.from("member_private").update({
    last_name: str(fd, "last_name"), phone: str(fd, "phone"), emergency_contact_name: str(fd, "emergency_contact_name"),
    emergency_contact_phone: str(fd, "emergency_contact_phone"), emergency_contact_relationship: optStr(fd, "emergency_contact_relationship"),
    medical_notes: optStr(fd, "medical_notes"),
  }).eq("user_id", uid);
  if (e2) return dbError(e2);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function uploadAvatar(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const file = fd.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, error: "Images must be under 3 MB." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const uid = c?.claims?.sub as string;
  const path = `${uid}/avatar-${Date.now()}.${file.type.split("/")[1]}`;
  const { error } = await sb.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" });
  if (error) return { ok: false, error: error.message };
  const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  await sb.from("profiles").update({ avatar_url: url }).eq("id", uid);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo updated." };
}

export async function removeAvatar(): Promise<void> {
  if (guardDemo()) return;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  await sb.from("profiles").update({ avatar_url: null }).eq("id", c?.claims?.sub as string);
  revalidatePath("/", "layout");
}

export async function submitAppeal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { error } = await sb.rpc("submit_appeal", { p_explanation: str(fd, "explanation"), p_application: optStr(fd, "application_id") });
  if (error) return dbError(error);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Thanks — an administrator will review your explanation and get back to you." };
}

export async function submitReport(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const details = str(fd, "details");
  if (details.length < 10) return { ok: false, error: "Please describe what happened (10+ characters)." };
  const { error } = await sb.from("content_reports").insert({
    reporter_id: c?.claims?.sub, category: str(fd, "category") || "other", details,
    event_id: optStr(fd, "event_id"), post_id: optStr(fd, "post_id"), subject_user_id: optStr(fd, "subject_user_id"),
  });
  if (error) return dbError(error);
  return { ok: true, message: "Report sent privately to our moderators. Thank you for looking out for the community." };
}

export async function deleteMyAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  if (str(fd, "confirm") !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.' };
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const uid = c?.claims?.sub as string;
  const { error } = await sb.rpc("delete_my_account");
  if (error) return dbError(error);
  await sb.auth.signOut();
  // Remove the login itself; anonymised records stay for legal retention.
  try {
    const admin = createServiceClient();
    await admin.auth.admin.deleteUser(uid, true);
  } catch (e) {
    console.error("[account deletion] could not remove auth user; profile already anonymised", e);
  }
  return { ok: true, message: "Your account has been deleted.", redirectTo: "/" };
}
