import "server-only";
import { createClient } from "../supabase/server";
import type { ApplicationStatus, AttendanceOutcome, PaymentMethod } from "../types";

export interface MyApplication {
  id: string;
  event_id: string;
  status: ApplicationStatus;
  attendance: AttendanceOutcome | null;
  waitlist_position: number | null;
  offer_expires_at: string | null;
  confirm_by: string | null;
  decision_message: string | null;
  payment_choice: PaymentMethod | null;
  created_at: string;
}

export async function getMyApplication(eventId: string, userId: string): Promise<MyApplication | null> {
  const sb = await createClient();
  const { data } = await sb.from("applications")
    .select("id,event_id,status,attendance,waitlist_position,offer_expires_at,confirm_by,decision_message,payment_choice,created_at")
    .eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  return (data as MyApplication) ?? null;
}

/** Outstanding steps for an approved member: waivers to sign and payments to make. */
export async function getConfirmationSteps(app: { id: string; event_id: string }, event: { price_cents: number; deposit_cents: number; payment_methods: PaymentMethod[] }) {
  const sb = await createClient();
  const [{ data: missing }, { data: payments }] = await Promise.all([
    sb.rpc("missing_waivers", { p_event: app.event_id }),
    sb.from("payments").select("id,kind,method,status,amount_cents,receipt_number").eq("application_id", app.id),
  ]);
  const paid = (kind: "fee" | "deposit") => (payments ?? []).some((p) => p.kind === kind && ["paid", "waived"].includes(p.status));
  return {
    missingWaivers: (missing ?? []) as { template_id: string; title: string; version: number }[],
    feeDue: event.price_cents > 0 && !paid("fee"),
    depositDue: event.deposit_cents > 0 && !paid("deposit"),
    cashAllowed: event.payment_methods.includes("cash"),
    onlineAllowed: event.payment_methods.includes("online"),
    payments: payments ?? [],
  };
}
