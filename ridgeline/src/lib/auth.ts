import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemoMode } from "./env";
import { createClient } from "./supabase/server";
import type { MemberStatus, StaffRole } from "./types";

export interface Viewer {
  id: string;
  email: string | null;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  status: MemberStatus;
  statusReason: string | null;
  roles: StaffRole[];
  isStaff: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isModerator: boolean;
  unread: number;
}

/** The signed-in member (validated against Supabase Auth), or null. One lookup per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (isDemoMode) return null;
  const sb = await createClient();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const [{ data: profile }, { data: roles }, { count }] = await Promise.all([
    sb.from("profiles").select("first_name,last_initial,avatar_url,status,status_reason").eq("id", uid).maybeSingle(),
    sb.from("staff_roles").select("role").eq("user_id", uid),
    sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
  ]);
  if (!profile) return null;
  const r = (roles ?? []).map((x) => x.role as StaffRole);
  return {
    id: uid, email: (claims?.claims?.email as string) ?? null, firstName: profile.first_name, lastInitial: profile.last_initial,
    avatarUrl: profile.avatar_url, status: profile.status, statusReason: profile.status_reason, roles: r,
    isStaff: r.length > 0, isAdmin: r.includes("admin") || r.includes("owner"), isOwner: r.includes("owner"),
    isModerator: r.some((x) => x === "moderator" || x === "admin" || x === "owner"), unread: count ?? 0,
  };
});

export async function requireViewer(next = "/dashboard") {
  if (isDemoMode) redirect("/demo");
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v;
}

export async function requireStaff() {
  const v = await requireViewer("/admin");
  if (!v.isStaff) redirect("/dashboard?error=staff-only");
  return v;
}

export async function requireAdmin() {
  const v = await requireStaff();
  if (!v.isAdmin) redirect("/admin?error=admin-only");
  return v;
}

export async function requireOwner() {
  const v = await requireStaff();
  if (!v.isOwner) redirect("/admin?error=owner-only");
  return v;
}
