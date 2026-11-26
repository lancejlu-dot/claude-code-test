import Link from "next/link";
import { CalendarPlus, Check, Circle } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/badges";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Notice, PageHeader } from "@/components/notices";
import { cancelApplication, confirmParticipation, respondToOffer, startCheckout } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";
import { getMissingWaivers, getMyApplications, isUpcoming, paidFor, type MyAppRow } from "@/lib/data/dashboard";
import { attendanceLabel, cn, formatDateTime, formatMoney } from "@/lib/format";
import { isStripeConfigured } from "@/lib/env";

export const metadata = { title: "My activities" };

export default async function MyActivities({ searchParams }: PageProps<"/dashboard/activities">) {
  const v = await requireViewer("/dashboard/activities");
  const sp = await searchParams;
  const apps = await getMyApplications(v.id);
  const missing = await getMissingWaivers(apps);
  const upcoming = apps.filter(isUpcoming).filter((a) => a.status !== "cancelled" || a.attendance);
  const history = apps.filter((a) => !upcoming.includes(a)).reverse();
  const stripe = isStripeConfigured();

  return (
    <div>
      <PageHeader title="My activities">Manage applications, complete next steps and cancel if your plans change.</PageHeader>
      <div className="space-y-3">
        {sp.applied && <Notice title="Application submitted">We&apos;ll notify you when organizers have reviewed it.</Notice>}
        {sp.payment === "cancelled" && <Notice tone="warn">Payment was cancelled — you haven&apos;t been charged.</Notice>}
      </div>
      <h2 className="mt-6 text-xl text-forest-950">Upcoming</h2>
      <div className="mt-3 space-y-4">
        {upcoming.length === 0 && <EmptyState title="No upcoming applications" action={<Link href="/activities" className="btn-primary">Browse activities</Link>} />}
        {upcoming.map((a) => <AppCard key={a.id} a={a} missing={missing.get(a.id) ?? []} stripe={stripe} />)}
      </div>
      <h2 className="mt-12 text-xl text-forest-950">History</h2>
      <div className="card mt-3 divide-y divide-forest-900/5">
        {history.length === 0 && <p className="p-5 text-sm text-muted">No past activities yet.</p>}
        {history.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <div><Link href={`/activities/${a.event.slug}`} className="font-medium text-forest-950 hover:underline">{a.event.title}</Link>
              <p className="text-muted">{formatDateTime(a.event.starts_at, a.event.time_zone)}{a.attendance ? ` · ${attendanceLabel[a.attendance]}` : ""}</p></div>
            <ApplicationStatusBadge status={a.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", done ? "bg-forest-700 text-white" : "bg-sand-200 text-muted")}>
        {done ? <Check className="h-3 w-3" aria-label="Done" /> : <Circle className="h-2 w-2" aria-label="To do" />}
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </li>
  );
}

function AppCard({ a, missing, stripe }: { a: MyAppRow; missing: { template_id: string; title: string }[]; stripe: boolean }) {
  const e = a.event;
  const holding = ["approved", "awaiting_confirmation", "confirmed"].includes(a.status);
  const cancellable = ["submitted", "under_review", "approved", "awaiting_confirmation", "confirmed", "waitlisted"].includes(a.status) && Date.parse(e.starts_at) > Date.now();
  const deadline = e.cancellation_deadline ? Date.parse(e.cancellation_deadline) : Date.parse(e.starts_at) - 48 * 3600_000;
  const late = holding && Date.now() > deadline;
  const feePaid = paidFor(a, "fee"); const depPaid = paidFor(a, "deposit");
  const cashPending = a.payments.some((p) => p.method === "cash" && p.status === "pending");
  return (
    <article id={`app-${a.id}`} className="card scroll-mt-24 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/activities/${e.slug}`} className="font-display text-xl text-forest-950 hover:underline">{e.title}</Link>
          <p className="text-sm text-muted">{formatDateTime(e.starts_at, e.time_zone)} · {e.general_location}</p>
        </div>
        <ApplicationStatusBadge status={a.status} />
      </div>
      {a.decision_message && ["approved", "awaiting_confirmation", "not_selected", "waitlisted"].includes(a.status) && (
        <p className="mt-3 rounded-xl bg-sand-100 p-3 text-sm"><span className="font-semibold">From the organizer:</span> {a.decision_message}</p>
      )}
      {a.status === "waitlisted" && <p className="mt-3 text-sm">You&apos;re <strong>#{a.waitlist_position ?? "—"}</strong> on the waitlist. We&apos;ll send you an offer if a space opens.</p>}

      {a.status === "awaiting_confirmation" && (
        <div className="mt-4 rounded-xl bg-ember-100/60 p-4">
          <p className="text-sm font-semibold text-ember-700">{a.invited ? "You've been invited!" : "A space opened up for you!"} Accept{a.offer_expires_at ? ` by ${formatDateTime(a.offer_expires_at, e.time_zone)}` : ""}.</p>
          <div className="mt-3 flex gap-2">
            <ActionForm action={respondToOffer}><input type="hidden" name="application_id" value={a.id} /><input type="hidden" name="accept" value="yes" /><SubmitButton className="btn-accent btn-sm">Accept place</SubmitButton></ActionForm>
            <ActionForm action={respondToOffer}><input type="hidden" name="application_id" value={a.id} /><input type="hidden" name="accept" value="no" /><SubmitButton className="btn-secondary btn-sm" confirm="Decline this place?">Decline</SubmitButton></ActionForm>
          </div>
        </div>
      )}

      {(a.status === "approved" || a.status === "confirmed") && (
        <ol className="mt-4 space-y-3 rounded-xl bg-sand-50 p-4">
          <Step done={missing.length === 0}>
            {missing.length === 0 ? "Waivers signed" : <>Sign {missing.map((m) => m.title).join(", ")} <Link href={`/waivers/${e.id}`} className="btn-primary btn-sm ml-2">Sign now</Link></>}
          </Step>
          {e.deposit_cents > 0 && (
            <Step done={depPaid}>
              {depPaid ? `Deposit paid (${formatMoney(e.deposit_cents)})` : <span className="flex flex-wrap items-center gap-2">Pay {formatMoney(e.deposit_cents)} deposit
                {stripe ? <ActionForm action={startCheckout}><input type="hidden" name="application_id" value={a.id} /><input type="hidden" name="kind" value="deposit" /><SubmitButton className="btn-primary btn-sm">Pay deposit online</SubmitButton></ActionForm>
                  : <span className="text-xs text-ember-700">Online payments not configured — contact the organizer.</span>}</span>}
            </Step>
          )}
          {e.price_cents > 0 && (
            <Step done={feePaid || cashPending}>
              {feePaid ? `Paid ${formatMoney(e.price_cents)}` : cashPending ? `Paying ${formatMoney(e.price_cents)} in cash at the event` : (
                <span className="flex flex-wrap items-center gap-2">Pay {formatMoney(e.price_cents)}
                  {e.payment_methods.includes("online") && (stripe
                    ? <ActionForm action={startCheckout}><input type="hidden" name="application_id" value={a.id} /><input type="hidden" name="kind" value="fee" /><SubmitButton className="btn-primary btn-sm" pendingText="Opening checkout…">Pay online</SubmitButton></ActionForm>
                    : <span className="text-xs text-ember-700">Online payments not configured yet.</span>)}
                  {e.payment_methods.includes("cash") && a.status === "approved" && <span className="text-xs text-muted">or choose cash when confirming below</span>}
                </span>
              )}
            </Step>
          )}
          <Step done={a.status === "confirmed"}>
            {a.status === "confirmed" ? (
              <span className="flex flex-wrap items-center gap-2">Attendance confirmed
                <Link href={`/activities/${e.slug}/hub`} className="btn-secondary btn-sm">Participant page</Link>
                <a href={`/api/events/${e.id}/ics`} className="btn-ghost btn-sm"><CalendarPlus className="h-3.5 w-3.5" aria-hidden />Calendar</a></span>
            ) : (
              <ActionForm action={confirmParticipation} className="space-y-2">
                <input type="hidden" name="application_id" value={a.id} />
                <p>Confirm your attendance{a.confirm_by ? ` by ${formatDateTime(a.confirm_by, e.time_zone)}` : ""}.</p>
                {e.price_cents > 0 && !feePaid && e.payment_methods.includes("cash") && (
                  <label className="flex items-center gap-2"><input type="checkbox" name="payment_choice" value="cash" className="accent-forest-700" />I&apos;ll pay {formatMoney(e.price_cents)} in cash at the event</label>
                )}
                <SubmitButton className="btn-accent btn-sm" pendingText="Confirming…">Confirm my place</SubmitButton>
              </ActionForm>
            )}
          </Step>
        </ol>
      )}

      {cancellable && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-ember-700">{holding ? "Cancel my place" : "Withdraw application"}</summary>
          <ActionForm action={cancelApplication} className="mt-3 space-y-3 rounded-xl bg-sand-50 p-4">
            <input type="hidden" name="application_id" value={a.id} />
            {holding && (late
              ? <p className="text-sm text-ember-700">The cancellation deadline has passed. Cancelling now is recorded as a <strong>late cancellation</strong>{e.price_cents ? " and fees may not be refunded" : ""}.</p>
              : <p className="text-sm text-forest-800">You&apos;re within the free cancellation period{e.cancellation_policy ? `. ${e.cancellation_policy}` : "."}</p>)}
            <label htmlFor={`reason-${a.id}`} className="label">Reason (optional, shared with organizers)</label>
            <input id={`reason-${a.id}`} name="reason" className="input" />
            {holding && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="emergency" className="mt-0.5 accent-forest-700" />This is an emergency, illness or safety-related withdrawal (never penalised)</label>}
            <SubmitButton className="btn-danger btn-sm" confirm="Are you sure you want to cancel?">{holding ? "Cancel my place" : "Withdraw"}</SubmitButton>
          </ActionForm>
        </details>
      )}
    </article>
  );
}
