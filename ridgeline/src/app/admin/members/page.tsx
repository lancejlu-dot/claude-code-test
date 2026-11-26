import Link from "next/link";
import { MemberStatusBadge } from "@/components/badges";
import { PageHeader } from "@/components/notices";
import { quickApprove } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, memberStatusLabel } from "@/lib/format";
import type { MemberStatus } from "@/lib/types";

export const metadata = { title: "Members" };

export default async function Members({ searchParams }: PageProps<"/admin/members">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const region = typeof sp.region === "string" ? sp.region : "";
  const sb = await createClient();
  let query = sb.from("profiles").select("id,first_name,last_initial,status,city,created_at,interests,hiking_experience,member_private(last_name,email),staff_roles!staff_roles_user_id_fkey(role)")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(300);
  if (status) query = query.eq("status", status);
  if (region) query = query.eq("home_region_id", region);
  if (q) query = query.or(`first_name.ilike.%${q.replace(/[%,()]/g, "")}%,city.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data }, { data: regions }] = await Promise.all([query, sb.from("regions").select("id,name").eq("kind", "area").order("sort_order")]);
  type M = { id: string; first_name: string; last_initial: string; status: MemberStatus; city: string | null; created_at: string; hiking_experience: string | null;
    member_private: { last_name: string; email: string } | null; staff_roles: { role: string }[] };
  const rows = (data ?? []) as unknown as M[];
  const filtered = q ? rows.filter((m) => `${m.first_name} ${m.member_private?.last_name} ${m.member_private?.email} ${m.city}`.toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <div>
      <PageHeader title="Members" actions={<a href="/api/admin/export/members" className="btn-secondary btn-sm">Export CSV</a>}>Search, approve and manage members. Contact details are visible to administrators only.</PageHeader>
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_200px_auto]" method="get">
        <label htmlFor="q" className="sr-only">Search</label><input id="q" name="q" defaultValue={q} placeholder="Search name, email, city" className="input" />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={status} className="input"><option value="">All statuses</option>{Object.entries(memberStatusLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label htmlFor="region" className="sr-only">Area</label>
        <select id="region" name="region" defaultValue={region} className="input"><option value="">All areas</option>{(regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <button className="btn-primary">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand-50 text-xs text-muted uppercase"><tr><th className="p-3">Member</th><th className="p-3">Email</th><th className="p-3">City</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-forest-900/5">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-sand-50/60">
                <td className="p-3"><Link href={`/admin/members/${m.id}`} className="font-medium text-forest-950 hover:underline">{m.first_name} {m.member_private?.last_name ?? `${m.last_initial}.`}</Link>
                  {m.staff_roles.length > 0 && <span className="ml-2 text-xs text-muted">{m.staff_roles.map((r) => r.role).join(", ")}</span>}</td>
                <td className="p-3 text-muted">{m.member_private?.email}</td>
                <td className="p-3">{m.city ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{formatDate(m.created_at)}</td>
                <td className="p-3"><MemberStatusBadge status={m.status} /></td>
                <td className="p-3 text-right">{m.status === "pending" && <form action={quickApprove}><input type="hidden" name="user_id" value={m.id} /><button className="btn-accent btn-sm">Approve</button></form>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No members match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
