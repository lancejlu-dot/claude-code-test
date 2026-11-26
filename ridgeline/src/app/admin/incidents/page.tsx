import Link from "next/link";
import { PageHeader } from "@/components/notices";
import { resolveIncident } from "@/lib/actions/admin";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Incidents" };

const SEV: Record<string, string> = { minor: "bg-sand-200", moderate: "bg-ember-100 text-ember-700", serious: "bg-ember-500 text-white", critical: "bg-ember-700 text-white" };

export default async function Incidents() {
  await requireStaff();
  const sb = await createClient();
  const { data } = await sb.from("incidents").select("id,severity,summary,details,actions_taken,occurred_at,resolved,follow_up_required,emergency_services_contacted,events(id,title),profiles!incidents_recorded_by_fkey(first_name)").order("occurred_at", { ascending: false }).limit(200);
  return (
    <div>
      <PageHeader title="Incident log">Recorded by organizers on the event-day roster. Visible to admins and the event&apos;s organizers.</PageHeader>
      <ul className="space-y-3">
        {(data ?? []).map((i) => { const ev = i.events as unknown as { id: string; title: string }; return (
          <li key={i.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className={`chip capitalize ${SEV[i.severity]}`}>{i.severity}</span><span className="font-semibold text-forest-950">{i.summary}</span></span>
              <span className="text-xs text-muted">{formatDateTime(i.occurred_at)}</span>
            </div>
            <p className="mt-1 text-sm text-muted"><Link href={`/admin/events/${ev.id}/roster`} className="underline">{ev.title}</Link> · recorded by {(i.profiles as unknown as { first_name: string } | null)?.first_name ?? "—"}{i.emergency_services_contacted && " · emergency services contacted"}{i.follow_up_required && " · follow-up required"}</p>
            {i.details && <p className="mt-2 text-sm">{i.details}</p>}
            {i.actions_taken && <p className="mt-1 text-sm"><strong>Actions:</strong> {i.actions_taken}</p>}
            <form action={resolveIncident} className="mt-3"><input type="hidden" name="incident_id" value={i.id} /><input type="hidden" name="resolved" value={String(!i.resolved)} />
              <button className={i.resolved ? "btn-ghost btn-sm" : "btn-secondary btn-sm"}>{i.resolved ? "Resolved ✓ (reopen)" : "Mark resolved"}</button></form>
          </li>); })}
        {(data ?? []).length === 0 && <li className="card p-6 text-sm text-muted">No incidents recorded.</li>}
      </ul>
    </div>
  );
}
