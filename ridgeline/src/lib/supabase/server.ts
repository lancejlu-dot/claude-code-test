import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isDemoMode, serviceRoleKey } from "../env";

/** Supabase client bound to the current user's session (RLS applies). */
export async function createClient() {
  if (isDemoMode) throw new Error("Supabase is not configured (demo mode).");
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code paths:
 * the Stripe webhook, scheduled jobs and removing a deleted account's login.
 */
export function createServiceClient() {
  const key = serviceRoleKey();
  if (!SUPABASE_URL || !key) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createPlainClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
