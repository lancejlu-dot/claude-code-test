import Link from "next/link";
import { CalendarDays, ClipboardList, Users, ShieldAlert, Wallet, FileSignature, Lightbulb, UserCheck } from "lucide-react";
import { Notice, PageHeader } from "@/components/notices";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isEmailConfigured, isStripeConfigured } from "@/lib/env";

export const metadata = { title: "Overview" };

type Stats = Record<string, number | null> & { revenue_by_category: { name: string; cents: number }[]; popular_categories: { name: string; applications: number }[] };

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const v = await requireStaff();
  const sp = await searchParams;
  const sb = await createClient();
  const stats = v.isAdmin ? ((await sb.rpc("admin_dashboard_stats")).data as Stats) : null;
  const { data: upcoming } = await sb.from("event_listing").select("id,title,starts_at,time_zone,spots_taken,max_participants,waitlist_count,public_status,status")
    .gte("starts_at", new Date().toISOString()).in("status", ["published", "postponed", "draft"]).order("starts_at").limit(8);
  const { count: pendingApps } = await sb.from("applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]);

  const cards = stats ? [
    { label: "Registered members", value: stats.members_total, icon: Users, href: "/admin/members" },
    { label: "Active members", value: stats.members_active, icon: UserCheck, href: "/admin/members?status=active" },
    { label: "Pending approvals", value: stats.members_pending, icon: ClipboardList, href: "/admin/members?status=pending", alert: (stats.members_pending ?? 0) > 0 },
    { label: "Upcoming events", value: stats.events_upcoming, icon: CalendarDays, href: "/admin/events" },
    { label: "Pending applications", value: stats.applications_pending, icon: ClipboardList, href: "/admin/events", alert: (stats.applications_pending ?? 0) > 0 },
    { label: "Open appeals", value: stats.appeals_open, icon: ShieldAlert, href: "/admin/appeals", alert: (stats.appeals_open ?? 0) > 0 },
    { label: "Unconfirmed no-shows", value: stats.no_shows_unconfirmed, icon: ShieldAlert, href: "/admin/members?status=active&flag=noshow", alert: (stats.no_shows_unconfirmed ?? 0) > 0 },
    { label: "Open reports", value: stats.reports_open, icon: ShieldAlert, href: "/admin/moderation", alert: (stats.reports_open ?? 0) > 0 },
    { label: "Outstanding waivers", value: stats.outstanding_waivers, icon: FileSignature, href: "/admin/events" },
    { label: "Outstanding payments", value: stats.outstanding_payments, icon: Wallet, href: "/admin/payments" },
    { label: "New suggestions", value: stats.suggestions_new, icon: Lightbulb, href: "/admin/suggestions" },
    { label: "Restricted / suspended", value: (stats.members_restricted ?? 0) + (stats.members_suspended ?? 0), icon: ShieldAlert, href: "/admin/members?status=restricted" },
  ] : [];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title={`Good to see you, ${v.firstName}`}>Community health at a glance.</PageHeader>
      {sp.error && <Notice tone="warn">That area requires {sp.error === "owner-only" ? "owner" : "administrator"} access.</Notice>}
      {v.isAdmin && (!isStripeConfigured() || !isEmailConfigured()) && (
        <Notice tone="warn" title="Integrations not fully configured">
          {!isStripeConfigured() && <span className="block">Stripe keys are missing — online payments are hidden from members.</span>}
          {!isEmailConfigured() && <span className="block">Resend keys are missing — emails are queued but <strong>not sent</strong>. In-app notifications still work.</span>}
        </Notice>
      )}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => (
              <Link key={c.label} href={c.href} className={`card p-4 transition hover:shadow-[var(--shadow-lift)] ${c.alert ? "ring-2 ring-ember-500/40" : ""}`}>
                <c.icon className={`h-4 w-4 ${c.alert ? "text-ember-600" : "text-moss-400"}`} aria-hidden />
                <p className="mt-2 font-display text-3xl text-forest-950">{c.value ?? 0}</p>
                <p className="text-xs text-muted">{c.label}</p>
              </Link>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Attendance rate", value: stats.attendance_rate, suffix: "%" },
              { label: "No-show rate", value: stats.no_show_rate, suffix: "%" },
              { label: "Repeat participation", value: stats.repeat_rate, suffix: "%" },
              { label: "Capacity utilization (90d)", value: stats.capacity_utilization, suffix: "%" },
            ].map((m) => (
              <div key={m.label} className="card p-5">
                <p className="text-sm text-muted">{m.label}</p>
                <p className="mt-1 font-display text-3xl text-forest-950">{m.value == null ? "—" : `${m.value}${m.suffix}`}</p>
                {m.value != null && <div className="mt-3 h-2 rounded-full bg-sand-200" aria-hidden><div className="h-2 rounded-full bg-forest-600" style={{ width: `${Math.min(Number(m.value), 100)}%` }} /></div>}
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-muted">Revenue (net of refunds)</p>
              <p className="mt-1 font-display text-3xl text-forest-950">{formatMoney(stats.revenue_cents ?? 0)}</p>
              <p className="mt-1 text-sm text-muted">Outstanding cash: {formatMoney(stats.outstanding_cash_cents ?? 0)}</p>
            </div>
            <BarList title="Revenue by activity" rows={stats.revenue_by_category.map((r) => ({ label: r.name, value: r.cents, display: formatMoney(r.cents) }))} />
            <BarList title="Popular categories (applications)" rows={stats.popular_categories.map((r) => ({ label: r.name, value: r.applications, display: String(r.applications) }))} />
          </div>
        </>
      )}
      {!stats && <Notice>You have {pendingApps ?? 0} pending applications across your events.</Notice>}
      <section className="card p-5">
        <div className="flex items-center justify-between"><h2 className="text-xl text-forest-950">Upcoming events</h2><Link href="/admin/events/new" className="btn-primary btn-sm">New event</Link></div>
        <ul className="mt-3 divide-y divide-forest-900/5">
          {(upcoming ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <Link href={`/admin/events/${e.id}`} className="font-medium text-forest-950 hover:underline">{e.title}{e.status === "draft" && <span className="chip ml-2 bg-sand-200">Draft</span>}</Link>
              <span className="flex items-center gap-4 text-muted">
                <span>{formatDateTime(e.starts_at, e.time_zone)}</span>
                <span className="w-28"><span className="block h-1.5 rounded-full bg-sand-200"><span className="block h-1.5 rounded-full bg-forest-600" style={{ width: `${Math.min(100, (100 * e.spots_taken) / e.max_participants)}%` }} /></span>
                  <span className="text-xs">{e.spots_taken}/{e.max_participants}{e.waitlist_count ? ` · ${e.waitlist_count} waitlist` : ""}</span></span>
                <Link href={`/admin/events/${e.id}/applications`} className="btn-ghost btn-sm">Applicants</Link>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-sm text-muted">No data yet.</li>}
        {rows.slice(0, 6).map((r) => (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between"><span>{r.label}</span><span className="font-medium">{r.display}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-sand-200"><div className="h-1.5 rounded-full bg-lake-600" style={{ width: `${(100 * r.value) / max}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
