import Link from "next/link";
import { PaymentStatusBadge } from "@/components/badges";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/notices";
import { refundPayment } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { isStripeConfigured } from "@/lib/env";
import type { PaymentStatus } from "@/lib/types";

export const metadata = { title: "Payments" };

export default async function AdminPayments({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const sb = await createClient();
  let q = sb.from("payments").select("id,kind,method,status,amount_cents,refunded_cents,receipt_number,paid_at,created_at,notes,stripe_checkout_session_id,events(id,title),profiles!payments_user_id_fkey(id,first_name,last_initial)").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  type P = { id: string; kind: string; method: string; status: PaymentStatus; amount_cents: number; refunded_cents: number; receipt_number: string | null; paid_at: string | null; created_at: string; notes: string | null; stripe_checkout_session_id: string | null;
    events: { id: string; title: string }; profiles: { id: string; first_name: string; last_initial: string } };
  const rows = (data ?? []) as unknown as P[];
  const sum = (f: (p: P) => boolean, v: (p: P) => number) => rows.filter(f).reduce((s, p) => s + v(p), 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" actions={<a href="/api/admin/export/payments" className="btn-secondary btn-sm">Export CSV</a>}>Online payments are processed by Stripe; card details never reach this platform.</PageHeader>
      {!isStripeConfigured() && <Notice tone="warn" title="Stripe not configured">Online checkout and Stripe refunds are disabled until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set. Payment rows marked “DEMO” in seed data are not real.</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-muted">Collected (net)</p><p className="font-display text-2xl">{formatMoney(sum((p) => ["paid", "partially_refunded"].includes(p.status), (p) => p.amount_cents - p.refunded_cents))}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Outstanding cash</p><p className="font-display text-2xl">{formatMoney(sum((p) => p.status === "pending" && p.method === "cash", (p) => p.amount_cents))}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Refunded</p><p className="font-display text-2xl">{formatMoney(sum(() => true, (p) => p.refunded_cents))}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">{["", "pending", "paid", "refunded", "partially_refunded", "waived", "failed"].map((s) => (
        <Link key={s} href={s ? `?status=${s}` : "?"} className={`btn btn-sm ${status === s ? "bg-forest-800 text-white" : "bg-white ring-1 ring-forest-900/10"}`}>{s ? s.replace("_", " ") : "All"}</Link>))}</div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand-50 text-xs text-muted uppercase"><tr><th className="p-3">Member</th><th className="p-3">Event</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Refund</th></tr></thead>
          <tbody className="divide-y divide-forest-900/5">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="p-3"><Link href={`/admin/members/${p.profiles.id}`} className="hover:underline">{p.profiles.first_name} {p.profiles.last_initial}.</Link></td>
                <td className="p-3">{p.events.title}{p.kind === "deposit" && " (deposit)"}{p.notes?.startsWith("DEMO") && <span className="chip ml-1 bg-sand-200">Demo</span>}</td>
                <td className="p-3 whitespace-nowrap">{formatMoney(p.amount_cents)}{p.refunded_cents > 0 && <span className="block text-xs text-muted">−{formatMoney(p.refunded_cents)}</span>}</td>
                <td className="p-3 capitalize">{p.method}</td>
                <td className="p-3"><PaymentStatusBadge status={p.status} />{p.receipt_number && <a href={`/api/receipts/${p.id}`} className="block text-xs text-lake-700 underline">{p.receipt_number}</a>}</td>
                <td className="p-3 whitespace-nowrap">{formatDate(p.paid_at ?? p.created_at)}</td>
                <td className="p-3">{["paid", "partially_refunded"].includes(p.status) && (
                  <ActionForm action={refundPayment} className="flex items-center gap-1">
                    <input type="hidden" name="payment_id" value={p.id} />
                    <label htmlFor={`r-${p.id}`} className="sr-only">Refund amount</label>
                    <input id={`r-${p.id}`} name="amount" type="number" step="0.01" defaultValue={((p.amount_cents - p.refunded_cents) / 100).toFixed(2)} className="input w-24 py-1 text-xs" />
                    <input name="reason" type="hidden" value="Refund per cancellation policy" />
                    <SubmitButton className="btn-ghost btn-sm" confirm="Issue this refund?">Refund</SubmitButton>
                  </ActionForm>)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">No payments.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
