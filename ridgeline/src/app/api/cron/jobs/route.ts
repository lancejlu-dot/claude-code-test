import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { isEmailConfigured } from "@/lib/env";

/**
 * Scheduled every 15 minutes (vercel.json). Runs waitlist/offer expiry, reminders and
 * restriction expiry in the database, then delivers queued emails through Resend.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  const { data: jobs, error } = await db.rpc("run_scheduled_jobs");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = new URL(req.url);
  const purge = url.searchParams.get("purge") === "1" ? (await db.rpc("purge_expired_data")).data : null;

  let sent = 0, failed = 0;
  if (isEmailConfigured()) {
    const { data: queue } = await db.from("email_outbox").select("id,to_email,subject,body_text,attempts").eq("status", "queued").order("created_at").limit(50);
    for (const m of queue ?? []) {
      await db.from("email_outbox").update({ status: "sending", attempts: m.attempts + 1 }).eq("id", m.id).eq("status", "queued");
      const r = await sendEmail(m.to_email, m.subject, m.body_text);
      if (r.id) { sent++; await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: r.id }).eq("id", m.id); }
      else { failed++; await db.from("email_outbox").update({ status: m.attempts + 1 >= 5 ? "failed" : "queued", last_error: r.error ?? "unknown" }).eq("id", m.id); }
    }
  }
  return NextResponse.json({ jobs, purge, email: isEmailConfigured() ? { sent, failed } : "provider not configured — emails remain queued" });
}
