"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { isDemoMode, siteUrl } from "../env";
import type { ActionResult } from "@/components/forms";

const DEMO_ERR: ActionResult = { ok: false, error: "This is a demo without a database — sign-in and sign-up are disabled." };
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");

export async function signIn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (isDemoMode) return DEMO_ERR;
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get("email") ?? "").trim(), password: String(fd.get("password") ?? "") });
  if (error) {
    return { ok: false, error: /confirm/i.test(error.message) ? "Please verify your email address first — check your inbox for the link." : "Email or password is incorrect." };
  }
  redirect(safeNext(fd.get("next")));
}

const phone = z.string().trim().min(7, "Enter a valid phone number").max(25).regex(/^[+()\d\s.-]+$/, "Enter a valid phone number");
const SignUp = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters for your password"),
  phone,
  emergency_contact_name: z.string().trim().min(2, "Emergency contact name is required").max(100),
  emergency_contact_phone: phone,
  emergency_contact_relationship: z.string().trim().max(60).optional(),
  intro: z.string().trim().min(20, "Tell us a bit more about yourself (20+ characters)").max(600),
  age_confirmed: z.literal("on", { error: "You must be at least 18 years old to join" }),
  guidelines_accepted: z.literal("on", { error: "Please accept the community guidelines" }),
  terms_accepted: z.literal("on", { error: "Please accept the privacy policy and terms of use" }),
  photo_consent: z.string().optional(),
});

export async function signUp(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (isDemoMode) return DEMO_ERR;
  const parsed = SignUp.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const sb = await createClient();
  const { error } = await sb.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard`,
      // Validated again by the database trigger (public.handle_new_user)
      data: {
        first_name: d.first_name, last_name: d.last_name, phone: d.phone, intro: d.intro,
        emergency_contact_name: d.emergency_contact_name, emergency_contact_phone: d.emergency_contact_phone,
        emergency_contact_relationship: d.emergency_contact_relationship ?? "",
        age_confirmed: true, guidelines_accepted: true, privacy_accepted: true, terms_accepted: true,
        photo_consent: d.photo_consent === "on",
      },
    },
  });
  if (error) return { ok: false, error: error.message.includes("registered") ? "An account with this email already exists. Try signing in." : error.message };
  redirect("/signup/check-email");
}

export async function requestPasswordReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (isDemoMode) return DEMO_ERR;
  const email = String(fd.get("email") ?? "").trim();
  if (!email) return { ok: false, error: "Enter your email address." };
  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/confirm?next=/reset-password` });
  // Same message whether or not the account exists (no account enumeration).
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (isDemoMode) return DEMO_ERR;
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 10) return { ok: false, error: "Use at least 10 characters." };
  if (pw !== fd.get("confirm")) return { ok: false, error: "Passwords don't match." };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return { ok: false, error: "Your reset link has expired. Request a new one." };
  return { ok: true, message: "Password updated.", redirectTo: "/dashboard" };
}

export async function signOut() {
  if (!isDemoMode) {
    const sb = await createClient();
    await sb.auth.signOut();
  }
  redirect("/");
}
