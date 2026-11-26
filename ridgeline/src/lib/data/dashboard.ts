import "server-only";
import { createClient } from "../supabase/server";
import type { ApplicationStatus, AttendanceOutcome, PaymentMethod, PaymentStatus } from "../types";

export interface MyAppRow {
  id: string;
  status: ApplicationStatus;
  attendance: AttendanceOutcome | null;
  waitlist_position: number | null;
  offer_expires_at: string | null;
  confirm_by: string | null;
  decision_message: string | null;
  payment_choice: PaymentMethod | null;
  invited: boolean;
  created_at: string;
  event: {
    id: string; slug: string; title: string; starts_at: string; ends_at: string | null; time_zone: string; status: string;
    general_location: string | null; price_cents: number; deposit_cents: number; currency: string; payment_methods: PaymentMethod[];
    cancellation_deadline: string | null; cover_image_url: string | null; cancellation_policy: string | null;
    activity_categories: { slug: string; name: string; icon: string } | null;
  };
  payments: { id: string; kind: "fee" | "deposit"; method: PaymentMethod; status: PaymentStatus; amount_cents: number; receipt_number: string | null }[];
}

export async function getMyApplications(userId: string): Promise<MyAppRow[]> {
  const sb = await createClient();
  const { data, error } = await sb.from("applications")
    .select(`id,status,attendance,waitlist_position,offer_expires_at,confirm_by,decision_message,payment_choice,invited,created_at,
      event:events(id,slug,title,starts_at,ends_at,time_zone,status,general_location,price_cents,deposit_cents,currency,payment_methods,cancellation_deadline,cover_image_url,cancellation_policy,activity_categories(slug,name,icon)),
      payments(id,kind,method,status,amount_cents,receipt_number)`)
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as unknown as MyAppRow[]).sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
}

/** Map of application id → missing waiver titles (for approved / confirmed upcoming apps). */
export async function getMissingWaivers(apps: MyAppRow[]) {
  const sb = await createClient();
  const relevant = apps.filter((a) => ["approved", "awaiting_confirmation", "confirmed"].includes(a.status));
  const out = new Map<string, { template_id: string; title: string }[]>();
  await Promise.all(relevant.map(async (a) => {
    const { data } = await sb.rpc("missing_waivers", { p_event: a.event.id });
    out.set(a.id, (data ?? []) as { template_id: string; title: string }[]);
  }));
  return out;
}

export const isUpcoming = (a: MyAppRow) => Date.parse(a.event.ends_at ?? a.event.starts_at) > Date.now();
export const paidFor = (a: MyAppRow, kind: "fee" | "deposit") => a.payments.some((p) => p.kind === kind && ["paid", "waived"].includes(p.status));
