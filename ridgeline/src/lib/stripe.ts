import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Stripe client (server only). Card data never touches our servers — we use hosted Checkout. */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(key, { appInfo: { name: "Ridgeline Collective" } });
  return client;
}
