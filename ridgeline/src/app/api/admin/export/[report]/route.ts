import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// CSV exports for staff. Every query runs under the caller's session, so RLS decides what they can export.
const csvCell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  // Prevent spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
};

export async function GET(req: Request, ctx: RouteContext<"/api/admin/export/[report]">) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const { report } = await ctx.params;
  const event = new URL(req.url).searchParams.get("event");
  const sb = await createClient();
  let rows: Record<string, unknown>[] = [];

  if (report === "members") {
    if (!viewer.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
    const { data } = await sb.from("profiles").select("id,first_name,status,city,created_at,hiking_experience,interests,member_private(last_name,email,phone)").is("deleted_at", null);
    rows = (data ?? []).map((p) => { const m = p.member_private as unknown as { last_name: string; email: string; phone: string } | null;
      return { id: p.id, first_name: p.first_name, last_name: m?.last_name, email: m?.email, phone: m?.phone, status: p.status, city: p.city, experience: p.hiking_experience, interests: p.interests, joined: p.created_at }; });
  } else if (report === "applications" || report === "roster") {
    if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
    const { data } = await sb.from("applications").select("id,status,attendance,created_at,checked_in_at,departed_safely_at,payment_choice,answers,profiles!applications_user_id_fkey(first_name,last_initial),payments(status,method,amount_cents,kind)").eq("event_id", event).order("created_at");
    rows = (data ?? []).filter((a) => report === "applications" || ["approved", "confirmed", "attended", "no_show"].includes(a.status)).map((a) => {
      const p = a.profiles as unknown as { first_name: string; last_initial: string };
      const pay = (a.payments as unknown as { status: string; method: string; amount_cents: number; kind: string }[]).find((x) => x.kind === "fee");
      return { member: `${p.first_name} ${p.last_initial}.`, status: a.status, attendance: a.attendance, applied: a.created_at, checked_in: a.checked_in_at, departed_safely: a.departed_safely_at,
        payment: pay ? `${pay.status} (${pay.method} $${(pay.amount_cents / 100).toFixed(2)})` : a.payment_choice ?? "", ...(report === "applications" ? { answers: JSON.stringify(a.answers) } : {}) };
    });
  } else if (report === "payments") {
    if (!viewer.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
    const { data } = await sb.from("payments").select("id,created_at,paid_at,kind,method,status,amount_cents,refunded_cents,currency,receipt_number,events(title),profiles!payments_user_id_fkey(first_name,last_initial)").order("created_at");
    rows = (data ?? []).map((p) => { const m = p.profiles as unknown as { first_name: string; last_initial: string }; return {
      receipt: p.receipt_number, member: `${m.first_name} ${m.last_initial}.`, event: (p.events as unknown as { title: string }).title, kind: p.kind, method: p.method, status: p.status,
      amount: (p.amount_cents / 100).toFixed(2), refunded: (p.refunded_cents / 100).toFixed(2), currency: p.currency, created: p.created_at, paid: p.paid_at }; });
  } else return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${report}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
