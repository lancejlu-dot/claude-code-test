import Link from "next/link";
import { PaymentStatusBadge } from "@/components/badges";
import { Notice, PageHeader } from "@/components/notices";
import { requireViewer } from "@/lib/auth";
import { getMyApplications, isUpcoming, paidFor } from "@/lib/data/dashboard";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Payments" };

export default async function Payments({ searchParams }: PageProps<"/dashboard/payments">) {
  const v = await requireViewer("/dashboard/payments");
  const sp = await searchParams;
  const sb = await createClient();
  const [apps, { data: payments }] = await Promise.all([
    getMyApplications(v.id),
    sb.from("payments").select("id,kind,method,status,amount_cents,refunded_cents,currency,receipt_number,paid_at,created_at,events(title,slug),refunds(amount_cents,created_at,reason)")
      .neq("status", "failed").order("created_at", { ascending: false }),
  ]);
  const outstanding = apps.filter((a) => isUpcoming(a) && ["approved", "confirmed"].includes(a.status) && a.event.price_cents > 0 && !paidFor(a, "fee"));
  return (
    <div className="space-y-8">
      <PageHeader title="Payments">You&apos;re only asked to pay after you&apos;re selected. Card payments are processed securely by Stripe — we never see or store your card number.</PageHeader>
      {sp.paid && <Notice title="Thank you!">Your payment is being confirmed. It can take a few seconds to appear below.</Notice>}
      <section>
        <h2 className="text-xl text-forest-950">Outstanding</h2>
        <ul className="card mt-3 divide-y divide-forest-900/5">
          {outstanding.length === 0 && <li className="p-5 text-sm text-muted">Nothing outstanding.</li>}
          {outstanding.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
              <div><p className="font-medium text-forest-950">{a.event.title}</p><p className="text-muted">{formatMoney(a.event.price_cents)} · {a.payment_choice === "cash" ? "Pay in cash at the event" : "Online payment due"}</p></div>
              {a.payment_choice !== "cash" && <Link href={`/dashboard/activities#app-${a.id}`} className="btn-primary btn-sm">Pay now</Link>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl text-forest-950">Transaction history</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand-50 text-xs text-muted uppercase"><tr><th className="p-3">Activity</th><th className="p-3">Date</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Receipt</th></tr></thead>
            <tbody className="divide-y divide-forest-900/5">
              {(payments ?? []).map((p) => {
                const ev = p.events as unknown as { title: string; slug: string } | null;
                return (
                  <tr key={p.id}>
                    <td className="p-3 font-medium">{ev?.title}{p.kind === "deposit" && " (deposit)"}</td>
                    <td className="p-3 whitespace-nowrap">{formatDate(p.paid_at ?? p.created_at)}</td>
                    <td className="p-3">{formatMoney(p.amount_cents, p.currency)}{p.refunded_cents > 0 && <span className="block text-xs text-muted">−{formatMoney(p.refunded_cents)} refunded</span>}</td>
                    <td className="p-3 capitalize">{p.method}</td>
                    <td className="p-3"><PaymentStatusBadge status={p.status} /></td>
                    <td className="p-3">{p.receipt_number ? <a href={`/api/receipts/${p.id}`} className="text-lake-700 underline">{p.receipt_number}</a> : "—"}</td>
                  </tr>
                );
              })}
              {(payments ?? []).length === 0 && <tr><td colSpan={6} className="p-5 text-muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-sm text-muted">Questions about a charge or refund? See the <Link href="/policies/cancellation-refund-policy" className="underline">cancellation & refund policy</Link>.</p>
    </div>
  );
}
