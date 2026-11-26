import Link from "next/link";
import { CalendarPlus, CheckCircle2, Hourglass, Lock } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/badges";
import { formatDateTime } from "@/lib/format";
import { isDemoMode } from "@/lib/env";
import type { MyApplication } from "@/lib/data/member";
import type { EventListing, MemberStatus } from "@/lib/types";

/** Call-to-action that reflects the viewer's membership and application state. */
export function ApplyPanel({ e, viewer, app }: { e: EventListing; viewer: { status: MemberStatus } | null; app: MyApplication | null }) {
  const canApplyNow = e.public_status === "open" || e.public_status === "waitlist";

  if (isDemoMode) {
    return <div className="space-y-2"><button disabled className="btn-accent w-full py-3">Apply for this activity</button>
      <p className="text-center text-xs text-muted">Demo mode — applications are disabled.</p></div>;
  }
  if (app && !(app.status === "cancelled" && !app.attendance)) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between"><span className="text-sm text-muted">Your status</span><ApplicationStatusBadge status={app.status} /></div>
        {app.status === "waitlisted" && app.waitlist_position && <p className="text-sm">You&apos;re #{app.waitlist_position} on the waitlist.</p>}
        {app.status === "approved" && <p className="rounded-xl bg-ember-100 p-3 text-sm text-ember-700">You&apos;ve been selected! Complete your steps{app.confirm_by ? ` by ${formatDateTime(app.confirm_by, e.time_zone)}` : ""}.</p>}
        {app.status === "awaiting_confirmation" && <p className="rounded-xl bg-ember-100 p-3 text-sm text-ember-700">A place is being held for you{app.offer_expires_at ? ` until ${formatDateTime(app.offer_expires_at, e.time_zone)}` : ""}.</p>}
        {app.status === "confirmed" ? (
          <div className="grid gap-2">
            <Link href={`/activities/${e.slug}/hub`} className="btn-primary w-full"><CheckCircle2 className="h-4 w-4" aria-hidden />Participant page</Link>
            <a href={`/api/events/${e.id}/ics`} className="btn-secondary w-full"><CalendarPlus className="h-4 w-4" aria-hidden />Add to calendar</a>
          </div>
        ) : (
          <Link href="/dashboard/activities" className="btn-primary w-full">{["approved", "awaiting_confirmation"].includes(app.status) ? "Complete next steps" : "Manage application"}</Link>
        )}
      </div>
    );
  }
  if (!viewer) {
    return canApplyNow ? (
      <div className="grid gap-2">
        <Link href={`/login?next=/activities/${e.slug}/apply`} className="btn-accent w-full py-3">Sign in to apply</Link>
        <Link href="/signup" className="btn-secondary w-full">New here? Join the community</Link>
      </div>
    ) : <Closed e={e} />;
  }
  if (viewer.status !== "active") {
    const msg: Partial<Record<MemberStatus, string>> = {
      pending: "Your membership is awaiting approval. You'll be able to apply once an administrator approves it.",
      restricted: "Your booking privileges are currently restricted. You can submit an explanation from your account standing page.",
      suspended: "Your membership is suspended.",
    };
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-xl bg-sand-100 p-3 text-sm"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{msg[viewer.status] ?? "Your account can't apply right now."}</p>
        {viewer.status === "restricted" && <Link href="/dashboard/standing" className="btn-secondary w-full">View account standing</Link>}
      </div>
    );
  }
  if (canApplyNow) {
    return (
      <div className="space-y-2">
        <Link href={`/activities/${e.slug}/apply`} className="btn-accent w-full py-3">{e.public_status === "waitlist" ? "Join the waitlist" : "Apply for this activity"}</Link>
        {e.public_status === "waitlist" && <p className="text-center text-xs text-muted">This activity is full. Applications go to the waitlist.</p>}
      </div>
    );
  }
  return <Closed e={e} />;
}

function Closed({ e }: { e: EventListing }) {
  const text = e.public_status === "upcoming" && e.registration_opens_at
    ? `Applications open ${formatDateTime(e.registration_opens_at, e.time_zone)}.`
    : e.public_status === "postponed" ? "This activity is postponed. A new date will be announced."
    : e.public_status === "cancelled" ? "This activity has been cancelled."
    : e.public_status === "completed" ? "This activity has finished."
    : "Applications are closed.";
  return <p className="flex items-start gap-2 rounded-xl bg-sand-100 p-3 text-sm"><Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{text}</p>;
}
