import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionResult } from "@/components/forms";
import { isDemoMode } from "../env";

/**
 * Database functions raise member-friendly messages for rule violations
 * (capacity, waivers, deadlines…). Anything unexpected becomes a generic error.
 */
export function dbError(e: PostgrestError | null | undefined, fallback = "Something went wrong. Please try again."): ActionResult {
  if (!e) return { ok: false, error: fallback };
  const friendly = e.code === "P0001" || e.code === "23514" || e.code === "23502" || e.code === "23505" || e.code === "22023" || e.code === "42501" || e.code === "P0002" || e.code === "28000";
  if (e.code === "42501" && /permission denied/i.test(e.message)) return { ok: false, error: "You don't have permission to do that." };
  if (!friendly) console.error("[db]", e.code, e.message);
  return { ok: false, error: friendly ? e.message : fallback };
}

export const demoBlocked: ActionResult = { ok: false, error: "Demo mode: no database is connected, so changes can't be saved." };
export const guardDemo = () => (isDemoMode ? demoBlocked : null);

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const lines = (fd: FormData, k: string) => str(fd, k).split("\n").map((s) => s.trim()).filter(Boolean);
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
