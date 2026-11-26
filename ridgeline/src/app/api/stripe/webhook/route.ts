import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

// Stripe webhook: verifies the signature, then records payments/refunds via service-role DB functions.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const db = createServiceClient();
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status === "paid") {
        const { error } = await db.rpc("record_online_payment", { p_session_id: s.id, p_payment_intent: String(s.payment_intent ?? ""), p_amount_cents: s.amount_total ?? 0 });
        if (error) throw error;
      }
    } else if (event.type === "checkout.session.expired") {
      await db.rpc("mark_checkout_expired", { p_session_id: (event.data.object as Stripe.Checkout.Session).id });
    } else if (event.type === "charge.refunded") {
      // Refunds issued directly in the Stripe dashboard are mirrored here (idempotent by refund id).
      const charge = event.data.object as Stripe.Charge;
      const { data: pay } = await db.from("payments").select("id").eq("stripe_payment_intent_id", String(charge.payment_intent)).maybeSingle();
      for (const r of charge.refunds?.data ?? []) {
        if (pay && r.status === "succeeded") await db.rpc("record_refund", { p_payment: pay.id, p_amount_cents: r.amount, p_reason: "Refunded in Stripe", p_stripe_refund_id: r.id });
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
