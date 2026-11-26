import Link from "next/link";
import { Plus } from "lucide-react";
import { EventStatusBadge } from "@/components/badges";
import { Notice, PageHeader } from "@/components/notices";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { EventListing } from "@/lib/types";

export const metadata = { title: "Events" };

export default async function AdminEvents({ searchParams }: PageProps<"/admin/events">) {
  const v = await requireStaff();
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : sp.when === "drafts" ? "drafts" : "upcoming";
  const sb = await createClient();
  let q = sb.from("event_listing").select("*");
  const now = new Date().toISOString();
  if (when === "past") q = q.lt("starts_at", now).neq("status", "draft").order("starts_at", { ascending: false }).limit(100);
  else if (when === "drafts") q = q.eq("status", "draft").order("starts_at");
  else q = q.gte("starts_at", now).neq("status", "draft").order("starts_at");
  const [{ data }, { data: pending }, { data: mine }] = await Promise.all([
    q,
    sb.from("applications").select("event_id").in("status", ["submitted", "under_review"]),
    sb.from("event_organizers").select("event_id").eq("user_id", v.id),
  ]);
  const pendingBy = new Map<string, number>();
  (pending ?? []).forEach((p) => pendingBy.set(p.event_id, (pendingBy.get(p.event_id) ?? 0) + 1));
  const mineSet = new Set((mine ?? []).map((m) => m.event_id));
  const events = ((data ?? []) as EventListing[]).filter((e) => v.isAdmin || mineSet.has(e.id));
  return (
    <div>
      <PageHeader title="Events" actions={v.isAdmin && <Link href="/admin/events/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />New event</Link>}>
        {v.isAdmin ? "Create, publish and manage every activity." : "Events you organize."}
      </PageHeader>
      {sp.deleted && <div className="mb-4"><Notice>Event deleted.</Notice></div>}
      <div className="mb-4 flex gap-2" role="tablist">
        {(["upcoming", "drafts", "past"] as const).map((w) => (
          <Link key={w} href={`/admin/events?when=${w}`} role="tab" aria-selected={when === w} className={`btn btn-sm ${when === w ? "bg-forest-800 text-white" : "bg-white ring-1 ring-forest-900/10"}`}>{w[0].toUpperCase() + w.slice(1)}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand-50 text-xs text-muted uppercase"><tr><th className="p-3">Event</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Capacity</th><th className="p-3">To review</th><th className="p-3">Price</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-forest-900/5">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-sand-50/60">
                <td className="p-3"><Link href={`/admin/events/${e.id}`} className="font-medium text-forest-950 hover:underline">{e.title}</Link><span className="block text-xs text-muted">{e.category_name} · {e.region_name}</span></td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(e.starts_at, e.time_zone)}</td>
                <td className="p-3"><EventStatusBadge status={e.public_status} /></td>
                <td className="p-3 whitespace-nowrap">{e.spots_taken}/{e.max_participants}{e.reserved_spots ? ` (+${e.reserved_spots} held)` : ""}{e.waitlist_count ? <span className="block text-xs text-muted">{e.waitlist_count} waitlisted</span> : null}</td>
                <td className="p-3">{pendingBy.get(e.id) ? <span className="chip bg-ember-100 text-ember-700">{pendingBy.get(e.id)} pending</span> : "—"}</td>
                <td className="p-3">{formatMoney(e.price_cents)}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Link href={`/admin/events/${e.id}/applications`} className="btn-ghost btn-sm">Applicants</Link>
                  <Link href={`/admin/events/${e.id}/roster`} className="btn-ghost btn-sm">Roster</Link>
                </td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">No events here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
