// Central place for configuration flags. Integrations are optional; the UI says
// clearly when one is not configured instead of pretending it works.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Demo mode: no Supabase project configured. Public pages render fictional sample data; writes are disabled. */
export const isDemoMode = !SUPABASE_URL || !SUPABASE_PUBLIC_KEY;

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
export const serviceRoleKey = () => process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
