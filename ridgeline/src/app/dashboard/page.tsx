import Link from "next/link";
import { ArrowRight, Mountain, Route, TrendingUp, TriangleAlert } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/badges";
import { Notice } from "@/components/notices";
import { requireViewer } from "@/lib/auth";
import { getMissingWaivers, getMyApplications, isUpcoming, paidFor } from "@/lib/data/dashboard";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, relativeFromNow } from "@/lib/format";

export const metadata = { title: "My dashboard" };

export default async function Dashboard() {
  const v = await requireViewer();
  const sb = await createClient();
  const [apps, { data: statsRows }, { data: notes }] = await Promise.all([
    getMyApplications(v.id), sb.rpc("my_activity_stats"),
    sb.from("notifications").select("id,title,body,link,created_at,read_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const stats = (statsRows as { completed: number; distance_km: number; elevation_m: number; upcoming: number }[] | null)?.[0];
  const missing = await getMissingWaivers(apps);
  const upcoming = apps.filter(isUpcoming);
  const todo = upcoming.filter((a) => a.status === "awaiting_confirmation" || a.status === "approved"
    || (a.status === "confirmed" && ((missing.get(a.id)?.length ?? 0) > 0 || (a.event.price_cents > 0 && !paidFor(a, "fee") && a.payment_choice === "online"))));
  const confirmed = upcoming.filter((a) => a.status === "confirmed");
  const pending = upcoming.filter((a) => ["submitted", "under_review"].includes(a.status));
  const waitlisted = upcoming.filter((a) => a.status === "waitlisted");
  const past = apps.filter((a) => !isUpcoming(a) && ["attended", "no_show"].includes(a.status)).reverse().slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-forest-950 sm:text-4xl">Hi {v.firstName} 👋</h1>
        <p className="mt-1 text-muted">Here&apos;s what&apos;s happening with your adventures.</p>
      </div>

      {v.status === "pending" && <Notice title="Your membership is being reviewed">An administrator reviews each new member, usually within two days. In the meantime, complete your <Link href="/dashboard/profile" className="underline">profile</Link> and browse <Link href="/activities" className="underline">upcoming activities</Link>.</Notice>}
      {(v.status === "restricted" || v.status === "suspended") && <Notice tone="warn" title={v.status === "restricted" ? "Your booking privileges are restricted" : "Your membership is suspended"}>{v.statusReason} <Link href="/dashboard/standing" className="font-semibold underline">View standing & submit an explanation</Link></Notice>}

      {todo.length > 0 && (
        <section aria-labelledby="todo" className="rounded-[var(--radius-card)] bg-ember-100/60 p-5 ring-1 ring-ember-600/20">
          <h2 id="todo" className="flex items-center gap-2 text-xl text-ember-700"><TriangleAlert className="h-5 w-5" aria-hidden />Action needed</h2>
          <ul className="mt-3 space-y-2">
            {todo.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold text-forest-950">{a.event.title}</p>
                  <p className="text-muted">
                    {a.status === "awaiting_confirmation" ? `Accept your place${a.offer_expires_at ? ` by ${formatDateTime(a.offer_expires_at, a.event.time_zone)}` : ""}`
                      : [ (missing.get(a.id)?.length ?? 0) > 0 && "sign waiver", a.event.price_cents > 0 && !paidFor(a, "fee") && a.payment_choice !== "cash" && "pay", a.status === "approved" && "confirm attendance"]
                        .filter(Boolean).join(" · ").replace(/^./, (c) => c.toUpperCase())}
                    {a.status === "approved" && a.confirm_by ? ` by ${formatDateTime(a.confirm_by, a.event.time_zone)}` : ""}
                  </p>
                </div>
                <Link href={`/dashboard/activities#app-${a.id}`} className="btn-accent btn-sm self-start">Continue</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Activities completed", value: stats?.completed ?? 0, icon: Mountain },
          { label: "Upcoming confirmed", value: stats?.upcoming ?? 0, icon: ArrowRight },
          { label: "Distance travelled", value: `${Math.round(Number(stats?.distance_km ?? 0))} km`, icon: Route },
          { label: "Elevation gained", value: `${Number(stats?.elevation_m ?? 0).toLocaleString("en-CA")} m`, icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="card p-4"><s.icon className="h-4 w-4 text-moss-400" aria-hidden /><p className="mt-2 font-display text-2xl text-forest-950">{s.value}</p><p className="text-xs text-muted">{s.label}</p></div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <AppList title="Upcoming confirmed" apps={confirmed} empty={<>Nothing confirmed yet. <Link href="/activities" className="underline">Find an activity</Link>.</>} hub />
        <AppList title="Pending applications" apps={pending} empty="No pending applications." />
        <AppList title="Waitlisted" apps={waitlisted} empty="You're not on any waitlists." />
        <AppList title="Recent activities" apps={past} empty="Your completed activities will appear here." />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between"><h2 className="text-xl text-forest-950">Latest notifications</h2><Link href="/dashboard/notifications" className="text-sm text-lake-700 hover:underline">See all</Link></div>
        <ul className="mt-3 divide-y divide-forest-900/5">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="py-3 text-sm">
              <Link href={n.link ?? "/dashboard/notifications"} className="block hover:text-forest-700">
                <span className={`font-medium ${n.read_at ? "text-forest-900" : "text-forest-950"}`}>{!n.read_at && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ember-500" aria-label="Unread" />}{n.title}</span>
                <span className="ml-2 text-xs text-muted">{relativeFromNow(n.created_at)}</span>
              </Link>
            </li>
          ))}
          {(notes ?? []).length === 0 && <li className="py-3 text-sm text-muted">No notifications yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function AppList({ title, apps, empty, hub }: { title: string; apps: Awaited<ReturnType<typeof getMyApplications>>; empty: React.ReactNode; hub?: boolean }) {
  return (
    <section className="card p-5">
      <h2 className="text-xl text-forest-950">{title}</h2>
      {apps.length === 0 ? <div className="mt-3"><EmptyStateInline>{empty}</EmptyStateInline></div> : (
        <ul className="mt-3 divide-y divide-forest-900/5">
          {apps.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <Link href={hub ? `/activities/${a.event.slug}/hub` : `/activities/${a.event.slug}`} className="min-w-0 text-sm">
                <span className="block truncate font-medium text-forest-950 hover:text-forest-700">{a.event.title}</span>
                <span className="text-muted">{formatDateTime(a.event.starts_at, a.event.time_zone)}{a.status === "waitlisted" && a.waitlist_position ? ` · #${a.waitlist_position} on waitlist` : ""}</span>
              </Link>
              <ApplicationStatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyStateInline({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
