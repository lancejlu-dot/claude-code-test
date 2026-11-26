import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge } from "@/components/badges";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { inviteMember, offerSpotDirect, reviewApplications } from "@/lib/actions/admin";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { experienceLabel, formatDate, formatDateTime, relativeFromNow } from "@/lib/format";
import type { ApplicationStatus, EventListing, ExperienceLevel } from "@/lib/types";

export const metadata = { title: "Applicants" };

type Rel = { applications: number; selected: number; attended: number; no_shows: number; late_cancellations: number; attendance_rate: number | null; last_attended: string | null; last_selected: string | null; warnings: number };

export default async function Applications({ params, searchParams }: PageProps<"/admin/events/[id]/applications">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "review";
  const sb = await createClient();
  const { data: e } = await sb.from("event_listing").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const ev = e as EventListing;
  const { data: apps } = await sb.from("applications")
    .select("id,user_id,status,answers,equipment_confirmed,note_to_organizer,experience_statement,wants_carpool,can_drive_seats,waitlist_position,offer_expires_at,confirm_by,invited,created_at,profiles!applications_user_id_fkey(first_name,last_initial,intro,hiking_experience,experience_summary,skills_certifications,status,created_at)")
    .eq("event_id", id).order("created_at");
  const rows = (apps ?? []) as unknown as {
    id: string; user_id: string; status: ApplicationStatus; answers: Record<string, string>; equipment_confirmed: string[]; note_to_organizer: string | null;
    experience_statement: string | null; wants_carpool: boolean | null; can_drive_seats: number | null; waitlist_position: number | null; offer_expires_at: string | null;
    confirm_by: string | null; invited: boolean; created_at: string;
    profiles: { first_name: string; last_initial: string; intro: string; hiking_experience: ExperienceLevel | null; experience_summary: string | null; skills_certifications: string[]; status: string; created_at: string };
  }[];
  const rel = new Map<string, Rel>();
  await Promise.all(rows.map(async (r) => { const { data } = await sb.rpc("member_reliability", { p_user: r.user_id }); rel.set(r.user_id, (data as Rel[])[0]); }));
  const groups: Record<string, ApplicationStatus[]> = {
    review: ["submitted", "under_review"], selected: ["approved", "awaiting_confirmation", "confirmed"], waitlist: ["waitlisted"],
    declined: ["not_selected", "cancelled"], all: [],
  };
  const shown = rows.filter((r) => filter === "all" || groups[filter]?.includes(r.status))
    .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0));
  const count = (k: string) => rows.filter((r) => k === "all" || groups[k].includes(r.status)).length;
  const free = Math.max(ev.max_participants - ev.reserved_spots - ev.spots_taken, 0);
  const reqCount = ev.required_equipment.length;

  return (
    <div>
      <Link href={`/admin/events/${ev.id}`} className="text-sm text-lake-700 hover:underline">← {ev.title}</Link>
      <PageHeader title="Review applicants" actions={<a href={`/api/admin/export/applications?event=${ev.id}`} className="btn-secondary btn-sm">Export CSV</a>}>
        {formatDateTime(ev.starts_at, ev.time_zone)} · <strong>{ev.spots_taken}</strong> of {ev.max_participants} places taken · <strong>{free}</strong> open{ev.reserved_spots ? ` · ${ev.reserved_spots} reserved` : ""}
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(groups).map((k) => (
          <Link key={k} href={`?status=${k}`} className={`btn btn-sm ${filter === k ? "bg-forest-800 text-white" : "bg-white ring-1 ring-forest-900/10"}`}>{k[0].toUpperCase() + k.slice(1)} ({count(k)})</Link>
        ))}
      </div>
      <p className="mb-4 rounded-xl bg-sand-100 p-3 text-xs text-forest-900">Select using activity-related criteria only: experience for the difficulty, reliability, equipment, answers, group safety balance and fair rotation (prioritise members who haven&apos;t been selected recently).</p>

      <ActionForm action={reviewApplications} className="space-y-3" messagePosition="top">
        {shown.map((r) => {
          const p = r.profiles; const m = rel.get(r.user_id);
          return (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <input type="checkbox" name="ids" value={r.id} className="mt-1.5 h-4 w-4 accent-forest-700" aria-label={`Select ${p.first_name}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/members/${r.user_id}`} className="font-semibold text-forest-950 hover:underline">{p.first_name} {p.last_initial}.</Link>
                    <ApplicationStatusBadge status={r.status} />
                    {r.invited && <span className="chip bg-lake-100 text-lake-700">Invited</span>}
                    {r.waitlist_position && r.status === "waitlisted" && <span className="chip bg-sand-200">#{r.waitlist_position}</span>}
                    {p.status !== "active" && <span className="chip bg-ember-100 text-ember-700">Member {p.status}</span>}
                    <span className="text-xs text-muted">applied {relativeFromNow(r.created_at)}</span>
                  </div>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-4">
                    <div><dt className="inline">Experience: </dt><dd className="inline font-medium text-forest-900">{p.hiking_experience ? experienceLabel[p.hiking_experience] : "—"}</dd></div>
                    <div><dt className="inline">Attended: </dt><dd className="inline font-medium text-forest-900">{m?.attended ?? 0}{m?.attendance_rate != null ? ` (${m.attendance_rate}% reliable)` : ""}</dd></div>
                    <div><dt className="inline">No-shows / late: </dt><dd className={`inline font-medium ${(m?.no_shows ?? 0) > 0 ? "text-ember-700" : "text-forest-900"}`}>{m?.no_shows ?? 0} / {m?.late_cancellations ?? 0}</dd></div>
                    <div><dt className="inline">Last selected: </dt><dd className="inline font-medium text-forest-900">{m?.last_selected ? formatDate(m.last_selected) : "never"}</dd></div>
                    <div><dt className="inline">Equipment: </dt><dd className="inline font-medium text-forest-900">{reqCount ? `${r.equipment_confirmed.length}/${reqCount} items` : "n/a"}</dd></div>
                    <div><dt className="inline">Warnings: </dt><dd className="inline font-medium text-forest-900">{m?.warnings ?? 0}</dd></div>
                    <div><dt className="inline">Carpool: </dt><dd className="inline font-medium text-forest-900">{r.wants_carpool ? "needs ride" : r.can_drive_seats ? `can drive ${r.can_drive_seats}` : "—"}</dd></div>
                    <div><dt className="inline">Member since: </dt><dd className="inline font-medium text-forest-900">{formatDate(p.created_at)}</dd></div>
                  </dl>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-lake-700">Answers & notes</summary>
                    <div className="mt-2 space-y-2 rounded-xl bg-sand-50 p-3">
                      {r.experience_statement && <p><strong>Experience:</strong> {r.experience_statement}</p>}
                      {ev.application_questions.map((q) => <p key={q.id}><strong>{q.label}</strong><br />{r.answers[q.id] || <em className="text-muted">No answer</em>}</p>)}
                      {r.note_to_organizer && <p><strong>Note:</strong> {r.note_to_organizer}</p>}
                      {reqCount > 0 && <p><strong>Missing gear:</strong> {ev.required_equipment.filter((x) => !r.equipment_confirmed.includes(x)).join(", ") || "none"}</p>}
                      <p className="text-muted">{p.intro}</p>
                    </div>
                  </details>
                </div>
                {r.status === "waitlisted" && (
                  <button formAction={offerSpotDirect} name="application_id" value={r.id} className="btn-secondary btn-sm">Offer space</button>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="card p-6 text-center text-sm text-muted">No applicants in this view.</p>}
        {shown.length > 0 && (
          <div className="sticky bottom-4 z-10 card space-y-3 p-4 shadow-[var(--shadow-lift)]">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <Field label="Message to selected members (optional)" htmlFor="message"><input id="message" name="message" className="input" placeholder="Shown in their notification" /></Field>
              <Field label="Confirm-by deadline (approvals)" htmlFor="confirm_by"><input id="confirm_by" name="confirm_by" type="datetime-local" className="input" /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="action" value="approve" className="btn-accent btn-sm">Approve selected</SubmitButton>
              <SubmitButton name="action" value="waitlist" className="btn-secondary btn-sm">Waitlist</SubmitButton>
              <SubmitButton name="action" value="under_review" className="btn-secondary btn-sm">Mark under review</SubmitButton>
              <SubmitButton name="action" value="not_selected" className="btn-secondary btn-sm">Not selected</SubmitButton>
              <SubmitButton name="action" value="remove" className="btn-danger btn-sm" confirm="Remove the selected participants? Their places will be released.">Remove</SubmitButton>
            </div>
          </div>
        )}
      </ActionForm>

      <section className="card mt-8 p-5">
        <h2 className="text-lg text-forest-950">Invite a specific member</h2>
        <p className="text-sm text-muted">Invitations can use reserved spaces. The member has {ev.waitlist_offer_hours}h to accept.</p>
        <InviteForm eventId={ev.id} />
      </section>
    </div>
  );
}

async function InviteForm({ eventId }: { eventId: string }) {
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("id,first_name,last_initial").eq("status", "active").is("deleted_at", null).order("first_name").limit(500);
  return (
    <ActionForm action={inviteMember} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="event_id" value={eventId} />
      <Field label="Member" htmlFor="user_id"><select id="user_id" name="user_id" required className="input">{(data ?? []).map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_initial}.</option>)}</select></Field>
      <Field label="Personal message" htmlFor="imsg"><input id="imsg" name="message" className="input" /></Field>
      <SubmitButton className="btn-primary btn-sm">Send invitation</SubmitButton>
    </ActionForm>
  );
}
