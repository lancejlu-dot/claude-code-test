import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Phone, Siren } from "lucide-react";
import { ApplicationStatusBadge, PaymentStatusBadge } from "@/components/badges";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/notices";
import { confirmNoShow, markDeparted, recordAttendance, recordCash, recordHeadcount, recordIncident, setCheckIn, waivePayment } from "@/lib/actions/admin";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceLabel, formatDateTime, formatMoney, formatTime } from "@/lib/format";
import type { ApplicationStatus, AttendanceOutcome, EventListing, PaymentStatus } from "@/lib/types";

export const metadata = { title: "Event-day roster" };

export default async function Roster({ params, searchParams }: PageProps<"/admin/events/[id]/roster">) {
  const v = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const sb = await createClient();
  const { data: e } = await sb.from("event_listing").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const ev = e as EventListing;
  const path = `/admin/events/${id}/roster`;
  const [{ data: apps }, { data: heads }, { data: incidents }] = await Promise.all([
    sb.from("applications").select("id,user_id,status,attendance,no_show_confirmed,checked_in_at,departed_safely_at,payment_choice,profiles!applications_user_id_fkey(first_name,last_initial),payments(id,kind,method,status,amount_cents)")
      .eq("event_id", id).in("status", ["approved", "confirmed", "attended", "no_show", "cancelled", "awaiting_confirmation"]).order("created_at"),
    sb.from("headcounts").select("*").eq("event_id", id).order("recorded_at", { ascending: false }),
    sb.from("incidents").select("id,severity,summary,occurred_at,resolved").eq("event_id", id).order("occurred_at", { ascending: false }),
  ]);
  type Row = { id: string; user_id: string; status: ApplicationStatus; attendance: AttendanceOutcome | null; no_show_confirmed: boolean; checked_in_at: string | null;
    departed_safely_at: string | null; payment_choice: string | null; profiles: { first_name: string; last_initial: string };
    payments: { id: string; kind: string; method: string; status: PaymentStatus; amount_cents: number }[] };
  const rows = ((apps ?? []) as unknown as Row[]).filter((r) => r.status !== "cancelled" || (r.attendance && r.attendance !== "cancelled_in_period"));
  const waiverMissing = new Map<string, number>();
  await Promise.all(rows.map(async (r) => { const { data } = await sb.rpc("missing_waivers", { p_event: id, p_user: r.user_id }); waiverMissing.set(r.id, (data ?? []).length); }));
  const contacts = sp.contacts === "1" ? ((await sb.rpc("get_event_emergency_contacts", { p_event: id })).data as { user_id: string; member_name: string; phone: string; emergency_contact_name: string; emergency_contact_phone: string; emergency_contact_relationship: string | null; medical_notes: string | null }[] | null) : null;
  const expected = rows.filter((r) => ["confirmed", "attended"].includes(r.status)).length;
  const checkedIn = rows.filter((r) => r.checked_in_at).length;
  const departed = rows.filter((r) => r.departed_safely_at).length;

  return (
    <div>
      <Link href={`/admin/events/${id}`} className="text-sm text-lake-700 hover:underline">← {ev.title}</Link>
      <PageHeader title="Event-day roster" actions={<a href={`/api/admin/export/roster?event=${id}`} className="btn-secondary btn-sm">Export / print CSV</a>}>
        {formatDateTime(ev.starts_at, ev.time_zone)} · Checked in <strong>{checkedIn}/{expected}</strong> · Safely departed <strong>{departed}/{checkedIn || expected}</strong>
      </PageHeader>

      <section className="card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Phone className="h-5 w-5 text-ember-600" aria-hidden /><h2 className="text-lg text-forest-950">Emergency contacts</h2></div>
          {!contacts && <Link href="?contacts=1" className="btn-danger btn-sm">Reveal (access is logged)</Link>}
        </div>
        {contacts && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted uppercase"><tr><th className="py-2 pr-3">Participant</th><th className="py-2 pr-3">Phone</th><th className="py-2 pr-3">Emergency contact</th><th className="py-2">Medical notes</th></tr></thead>
              <tbody className="divide-y divide-forest-900/5">
                {contacts.map((c) => (
                  <tr key={c.user_id}><td className="py-2 pr-3 font-medium">{c.member_name}</td><td className="py-2 pr-3"><a href={`tel:${c.phone}`} className="text-lake-700 underline">{c.phone}</a></td>
                    <td className="py-2 pr-3">{c.emergency_contact_name}{c.emergency_contact_relationship ? ` (${c.emergency_contact_relationship})` : ""} · <a href={`tel:${c.emergency_contact_phone}`} className="text-lake-700 underline">{c.emergency_contact_phone}</a></td>
                    <td className="py-2">{c.medical_notes ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Use only for safety purposes during this event. Do not copy or share.</p>
          </div>
        )}
      </section>

      <div className="space-y-3">
        {rows.map((r) => {
          const fee = r.payments.find((p) => p.kind === "fee" && p.status !== "failed");
          const missingW = waiverMissing.get(r.id) ?? 0;
          return (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <form action={setCheckIn}>
                  <input type="hidden" name="application_id" value={r.id} /><input type="hidden" name="checked" value={String(!r.checked_in_at)} /><input type="hidden" name="path" value={path} />
                  <button aria-pressed={Boolean(r.checked_in_at)} aria-label={`Check in ${r.profiles.first_name}`}
                    className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${r.checked_in_at ? "bg-forest-700 text-white ring-forest-700" : "bg-white ring-forest-900/20"}`}>
                    {r.checked_in_at && <Check className="h-5 w-5" aria-hidden />}
                  </button>
                </form>
                <div className="min-w-32 flex-1">
                  <Link href={v.isAdmin ? `/admin/members/${r.user_id}` : "#"} className="font-semibold text-forest-950">{r.profiles.first_name} {r.profiles.last_initial}.</Link>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <ApplicationStatusBadge status={r.status} />
                    {missingW > 0 ? <span className="chip bg-ember-100 text-ember-700">Waiver missing</span> : <span className="chip bg-moss-100 text-forest-800">Waiver ✓</span>}
                    {ev.price_cents > 0 && (fee ? <PaymentStatusBadge status={fee.status} /> : <span className="chip bg-ember-100 text-ember-700">Unpaid</span>)}
                    {fee?.method === "cash" && <span className="chip bg-sand-200">Cash</span>}
                    {r.checked_in_at && <span className="text-xs text-muted">in {formatTime(r.checked_in_at, ev.time_zone)}</span>}
                  </div>
                </div>
                <ActionForm action={recordAttendance} className="flex items-center gap-2">
                  <input type="hidden" name="application_id" value={r.id} />
                  <label htmlFor={`att-${r.id}`} className="sr-only">Attendance</label>
                  <select id={`att-${r.id}`} name="outcome" defaultValue={r.attendance ?? ""} className="input w-48 py-1.5 text-sm">
                    <option value="" disabled>Attendance…</option>
                    {(["attended", "cancelled_in_period", "late_cancellation", "excused_absence", "unexcused_no_show"] as AttendanceOutcome[]).map((o) => <option key={o} value={o}>{attendanceLabel[o]}</option>)}
                  </select>
                  <SubmitButton className="btn-secondary btn-sm" pendingText="…">Save</SubmitButton>
                </ActionForm>
                <form action={markDeparted}>
                  <input type="hidden" name="application_id" value={r.id} /><input type="hidden" name="departed" value={String(!r.departed_safely_at)} /><input type="hidden" name="path" value={path} />
                  <button className={`btn btn-sm ${r.departed_safely_at ? "bg-moss-100 text-forest-800" : "bg-white ring-1 ring-forest-900/15"}`}>{r.departed_safely_at ? "Departed safely ✓" : "Mark departed safely"}</button>
                </form>
              </div>
              {(r.attendance === "unexcused_no_show" && !r.no_show_confirmed && v.isAdmin) && (
                <ActionForm action={confirmNoShow} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-ember-100/60 p-3 text-sm">
                  <input type="hidden" name="application_id" value={r.id} />
                  <span className="text-ember-700">Organizer recorded an unexcused no-show. Confirming restricts the member automatically.</span>
                  <SubmitButton className="btn-danger btn-sm" confirm="Confirm no-show and restrict this member?">Confirm no-show</SubmitButton>
                </ActionForm>
              )}
              {ev.price_cents > 0 && (!fee || fee.status === "pending") && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <ActionForm action={recordCash} className="flex items-end gap-2">
                    <input type="hidden" name="application_id" value={r.id} />
                    <Field label="Cash received ($)" htmlFor={`cash-${r.id}`}><input id={`cash-${r.id}`} name="amount" type="number" step="0.01" defaultValue={(ev.price_cents / 100).toFixed(2)} className="input w-28 py-1.5" /></Field>
                    <SubmitButton className="btn-secondary btn-sm">Record cash</SubmitButton>
                  </ActionForm>
                  {v.isAdmin && <ActionForm action={waivePayment} className="flex items-end gap-2"><input type="hidden" name="application_id" value={r.id} /><SubmitButton className="btn-ghost btn-sm" confirm="Waive this fee?">Waive fee</SubmitButton></ActionForm>}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <Notice>No selected participants yet.</Notice>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg text-forest-950">Headcounts</h2>
          <ActionForm action={recordHeadcount} className="mt-3 grid grid-cols-3 gap-2" resetOnSuccess>
            <input type="hidden" name="event_id" value={id} />
            <Field label="Checkpoint" htmlFor="label" className="col-span-3"><input id="label" name="label" className="input" placeholder="Trailhead / Summit / Back at cars" /></Field>
            <Field label="Counted" htmlFor="counted"><input id="counted" name="counted" type="number" min={0} required className="input" /></Field>
            <Field label="Expected" htmlFor="expected"><input id="expected" name="expected" type="number" min={0} defaultValue={checkedIn || expected} required className="input" /></Field>
            <div className="flex items-end"><SubmitButton className="btn-primary btn-sm w-full">Record</SubmitButton></div>
          </ActionForm>
          <ul className="mt-4 divide-y divide-forest-900/5 text-sm">
            {(heads ?? []).map((h) => (
              <li key={h.id} className="flex justify-between py-2"><span>{h.label} · {formatTime(h.recorded_at, ev.time_zone)}</span>
                <span className={h.counted === h.expected ? "font-semibold text-forest-700" : "font-semibold text-ember-700"}>{h.counted}/{h.expected}</span></li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-lg text-forest-950"><Siren className="h-5 w-5 text-ember-600" aria-hidden />Record an incident</h2>
          <p className="text-xs text-muted">In an emergency, call 911 first.</p>
          <ActionForm action={recordIncident} className="mt-3 space-y-3" resetOnSuccess>
            <input type="hidden" name="event_id" value={id} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Severity" htmlFor="severity"><select id="severity" name="severity" className="input"><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="serious">Serious</option><option value="critical">Critical</option></select></Field>
              <Field label="When" htmlFor="occurred_at"><input id="occurred_at" name="occurred_at" type="datetime-local" className="input" /></Field>
            </div>
            <Field label="Summary" htmlFor="summary"><input id="summary" name="summary" required className="input" /></Field>
            <Field label="What happened" htmlFor="details"><textarea id="details" name="details" rows={2} className="input" /></Field>
            <Field label="Actions taken" htmlFor="actions_taken"><textarea id="actions_taken" name="actions_taken" rows={2} className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emergency_services_contacted" className="accent-forest-700" />Emergency services contacted</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="follow_up_required" className="accent-forest-700" />Follow-up required</label>
            <SubmitButton className="btn-primary btn-sm">Save incident</SubmitButton>
          </ActionForm>
          {(incidents ?? []).length > 0 && <ul className="mt-4 space-y-1 text-sm">{(incidents ?? []).map((i) => <li key={i.id}><span className="chip bg-ember-100 text-ember-700">{i.severity}</span> {i.summary}{i.resolved ? " · resolved" : ""}</li>)}</ul>}
        </section>
      </div>
      <p className="mt-6 text-xs text-muted">Fee: {formatMoney(ev.price_cents)}. Event cancellations, organizer mistakes and emergencies should be recorded as excused — they never trigger restrictions.</p>
    </div>
  );
}
