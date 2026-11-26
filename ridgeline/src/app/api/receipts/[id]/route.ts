import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrand } from "@/lib/data/public";
import { renderPdf } from "@/lib/pdf";
import { formatDateLong, formatMoney } from "@/lib/format";

// Payment receipt (PDF). RLS limits access to the payer and event staff.
export async function GET(_: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: p } = await sb.from("payments").select("id,amount_cents,refunded_cents,currency,method,status,kind,receipt_number,paid_at,events(title,starts_at)").eq("id", id).maybeSingle();
  if (!p || !p.receipt_number) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  const brand = await getBrand();
  const ev = p.events as unknown as { title: string; starts_at: string };
  const bytes = await renderPdf(`${brand.name} — Receipt ${p.receipt_number}`, [
    { heading: "Activity", body: `${ev.title} (${formatDateLong(ev.starts_at)})` },
    { heading: "Payment", body: `${p.kind === "deposit" ? "Deposit" : "Participation fee"}: ${formatMoney(p.amount_cents, p.currency)} ${p.currency}\nMethod: ${p.method === "online" ? "Card (processed by Stripe)" : p.method}\nPaid: ${p.paid_at ? formatDateLong(p.paid_at) : "-"}\nStatus: ${p.status}${p.refunded_cents ? `\nRefunded: ${formatMoney(p.refunded_cents)}` : ""}` },
  ], `${brand.name} · ${brand.contact_email}. Keep this receipt for your records.`);
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${p.receipt_number}.pdf"` } });
}
