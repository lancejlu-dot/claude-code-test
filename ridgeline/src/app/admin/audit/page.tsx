import { PageHeader } from "@/components/notices";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action : "";
  const sb = await createClient();
  let q = sb.from("audit_log").select("id,action,entity,entity_id,details,created_at,profiles!audit_log_actor_id_fkey(first_name,last_initial)").order("created_at", { ascending: false }).limit(300);
  if (action) q = q.ilike("action", `${action.replace(/[%_]/g, "")}%`);
  const { data } = await q;
  return (
    <div>
      <PageHeader title="Audit log">Significant administrative actions, including every view of emergency contacts.</PageHeader>
      <form className="mb-4 flex gap-2" method="get"><label htmlFor="action" className="sr-only">Filter</label><input id="action" name="action" defaultValue={action} placeholder="Filter by action prefix, e.g. member. or emergency" className="input max-w-sm" /><button className="btn-secondary">Filter</button></form>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand-50 text-xs text-muted uppercase"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Details</th></tr></thead>
          <tbody className="divide-y divide-forest-900/5">
            {(data ?? []).map((a) => { const p = a.profiles as unknown as { first_name: string; last_initial: string } | null; return (
              <tr key={a.id}><td className="p-3 whitespace-nowrap">{formatDateTime(a.created_at)}</td><td className="p-3">{p ? `${p.first_name} ${p.last_initial}.` : "System"}</td>
                <td className="p-3 font-mono text-xs">{a.action}</td><td className="p-3 text-xs text-muted">{a.entity} {a.entity_id?.slice(0, 8)}</td>
                <td className="max-w-xs truncate p-3 font-mono text-xs text-muted">{JSON.stringify(a.details)}</td></tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
