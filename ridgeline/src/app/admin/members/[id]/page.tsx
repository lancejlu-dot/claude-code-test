import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge, MemberStatusBadge } from "@/components/badges";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { addNote, awardBadge, issueWarning, setGroupMembership, setMemberStatus, setStaffRole } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceLabel, experienceLabel, formatDate, formatDateTime } from "@/lib/format";
import type { ApplicationStatus, AttendanceOutcome, ExperienceLevel, MemberStatus, StaffRole } from "@/lib/types";

export const metadata = { title: "Member" };

export default async function MemberDetail({ params }: PageProps<"/admin/members/[id]">) {
  const v = await requireAdmin();
  const { id } = await params;
  const sb = await createClient();
  const [{ data: p }, { data: priv }, { data: roles }, { data: apps }, { data: notes }, { data: warnings }, { data: rel }, { data: badges }, { data: myBadges }, { data: groups }, { data: myGroups }, { data: sigs }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).maybeSingle(),
    sb.from("member_private").select("*").eq("user_id", id).maybeSingle(),
    sb.from("staff_roles").select("role").eq("user_id", id),
    sb.from("applications").select("id,status,attendance,created_at,events(id,title,starts_at)").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("admin_notes").select("id,body,created_at,profiles!admin_notes_author_id_fkey(first_name)").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("member_warnings").select("id,message,created_at").eq("user_id", id).order("created_at", { ascending: false }),
    sb.rpc("member_reliability", { p_user: id }),
    sb.from("badges").select("id,name"), sb.from("member_badges").select("badge_id").eq("user_id", id),
    sb.from("member_groups").select("id,name"), sb.from("member_group_members").select("group_id").eq("user_id", id),
    sb.from("waiver_signatures").select("id,version,signed_at,waiver_templates(title)").eq("user_id", id).order("signed_at", { ascending: false }),
  ]);
  if (!p) notFound();
  const r = (rel as { attended: number; no_shows: number; late_cancellations: number; cancelled_in_period: number; excused: number; attendance_rate: number | null }[])[0];
  const roleSet = new Set((roles ?? []).map((x) => x.role as StaffRole));
  const status = p.status as MemberStatus;
  return (
    <div className="space-y-6">
      <Link href="/admin/members" className="text-sm text-lake-700 hover:underline">← Members</Link>
      <PageHeader title={`${p.first_name} ${priv?.last_name ?? ""}`} actions={<MemberStatusBadge status={status} />}>
        Joined {formatDate(p.created_at)}{roleSet.size ? ` · ${[...roleSet].join(", ")}` : ""}{p.status_reason ? ` · ${p.status_reason}` : ""}
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <div><h2 className="text-lg text-forest-950">Contact (confidential)</h2>
              <dl className="mt-2 space-y-1 text-sm"><div>{priv?.email}</div><div>{priv?.phone}</div>
                <div className="text-muted">Emergency: {priv?.emergency_contact_name} ({priv?.emergency_contact_relationship ?? "—"}) · {priv?.emergency_contact_phone}</div>
                {priv?.medical_notes && <div className="text-muted">Medical: {priv.medical_notes}</div>}</dl></div>
            <div><h2 className="text-lg text-forest-950">Profile</h2>
              <p className="mt-2 text-sm">{p.intro}</p>
              <p className="mt-1 text-sm text-muted">{p.hiking_experience ? experienceLabel[p.hiking_experience as ExperienceLevel] : "Experience not set"} · {p.city ?? "—"} · Vehicle: {p.has_vehicle == null ? "—" : p.has_vehicle ? "yes" : "no"} · Photo consent: {p.photo_consent ? "yes" : "no"}</p>
              {p.skills_certifications.length > 0 && <p className="mt-1 text-sm text-muted">{p.skills_certifications.join(", ")}</p>}</div>
          </section>
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Reliability</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
              {[["Attended", r?.attended], ["In-time cancels", r?.cancelled_in_period], ["Late cancels", r?.late_cancellations], ["Excused", r?.excused], ["No-shows", r?.no_shows], ["Reliability", r?.attendance_rate != null ? `${r.attendance_rate}%` : "—"]].map(([k, val]) => (
                <div key={k as string}><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-2xl">{val ?? 0}</dd></div>))}
            </dl>
          </section>
          <section className="card overflow-x-auto p-5">
            <h2 className="text-lg text-forest-950">Participation history</h2>
            <table className="mt-3 w-full text-left text-sm"><tbody className="divide-y divide-forest-900/5">
              {(apps ?? []).map((a) => { const ev = a.events as unknown as { id: string; title: string; starts_at: string }; return (
                <tr key={a.id}><td className="py-2 pr-3"><Link href={`/admin/events/${ev.id}/applications`} className="hover:underline">{ev.title}</Link></td><td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDate(ev.starts_at)}</td>
                  <td className="py-2 pr-3"><ApplicationStatusBadge status={a.status as ApplicationStatus} /></td><td className="py-2 text-muted">{a.attendance ? attendanceLabel[a.attendance as AttendanceOutcome] : ""}</td></tr>); })}
              {(apps ?? []).length === 0 && <tr><td className="py-2 text-muted">No applications yet.</td></tr>}
            </tbody></table>
          </section>
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Signed waivers</h2>
            <ul className="mt-2 divide-y divide-forest-900/5 text-sm">{(sigs ?? []).map((s) => (
              <li key={s.id} className="flex justify-between py-2"><span>{(s.waiver_templates as unknown as { title: string }).title} v{s.version} · {formatDateTime(s.signed_at)}</span><a href={`/api/waivers/${s.id}/pdf`} className="text-lake-700 underline">PDF</a></li>))}
              {(sigs ?? []).length === 0 && <li className="py-2 text-muted">None.</li>}</ul>
          </section>
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Confidential admin notes</h2>
            <p className="text-xs text-muted">Never shown to the member.</p>
            <ActionForm action={addNote} className="mt-3 flex gap-2" resetOnSuccess><input type="hidden" name="user_id" value={id} /><label htmlFor="nb" className="sr-only">Note</label><input id="nb" name="body" className="input" placeholder="Add a note…" /><SubmitButton className="btn-secondary btn-sm">Add</SubmitButton></ActionForm>
            <ul className="mt-3 space-y-2 text-sm">{(notes ?? []).map((n) => <li key={n.id} className="rounded-lg bg-sand-50 p-3">{n.body}<span className="mt-1 block text-xs text-muted">{(n.profiles as unknown as { first_name: string } | null)?.first_name ?? "System"} · {formatDateTime(n.created_at)}</span></li>)}</ul>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Membership status</h2>
            <ActionForm action={setMemberStatus} className="mt-3 space-y-3">
              <input type="hidden" name="user_id" value={id} />
              <Field label="New status" htmlFor="st"><select id="st" name="status" defaultValue={status === "pending" ? "active" : status} className="input">
                <option value="active">Active (approve / reactivate)</option><option value="restricted">Restricted (can&apos;t apply)</option><option value="suspended">Suspended</option>
                <option value="removed">Removed</option>{status === "pending" && <option value="rejected">Not approved</option>}</select></Field>
              <Field label="Duration (days, optional)" htmlFor="days" hint="Restrictions/suspensions lift automatically."><input id="days" name="days" type="number" min={1} className="input" /></Field>
              <Field label="Message to member" htmlFor="mm" hint="Member-facing. Leave blank for a standard message."><textarea id="mm" name="member_message" rows={2} className="input" /></Field>
              <Field label="Internal note (confidential)" htmlFor="inote"><textarea id="inote" name="internal_note" rows={2} className="input" /></Field>
              <SubmitButton className="btn-primary btn-sm" confirm="Change this member's status and notify them?">Update status</SubmitButton>
            </ActionForm>
          </section>
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Issue a warning</h2>
            <ActionForm action={issueWarning} className="mt-3 space-y-2" resetOnSuccess><input type="hidden" name="user_id" value={id} />
              <label htmlFor="wm" className="sr-only">Warning</label><textarea id="wm" name="message" rows={2} className="input" placeholder="Shown privately to the member" />
              <SubmitButton className="btn-secondary btn-sm">Send warning</SubmitButton></ActionForm>
            <ul className="mt-3 space-y-1 text-xs text-muted">{(warnings ?? []).map((w) => <li key={w.id}>{formatDate(w.created_at)}: {w.message}</li>)}</ul>
          </section>
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Badges & groups</h2>
            <ActionForm action={awardBadge} className="mt-3 flex gap-2"><input type="hidden" name="user_id" value={id} />
              <label htmlFor="bd" className="sr-only">Badge</label><select id="bd" name="badge_id" className="input py-1.5 text-sm">{(badges ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}{(myBadges ?? []).some((m) => m.badge_id === b.id) ? " ✓" : ""}</option>)}</select>
              <SubmitButton className="btn-secondary btn-sm">Award</SubmitButton></ActionForm>
            <ActionForm action={setGroupMembership} className="mt-4 space-y-2"><input type="hidden" name="user_id" value={id} />
              {(groups ?? []).map((g) => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="groups" value={g.id} defaultChecked={(myGroups ?? []).some((m) => m.group_id === g.id)} className="accent-forest-700" />{g.name}</label>)}
              {(groups ?? []).length > 0 && <SubmitButton className="btn-ghost btn-sm">Save groups</SubmitButton>}</ActionForm>
          </section>
          {v.isOwner && (
            <section className="card p-5">
              <h2 className="text-lg text-forest-950">Staff roles (owner)</h2>
              <div className="mt-3 space-y-2">
                {(["organizer", "moderator", "admin", "owner"] as StaffRole[]).map((role) => (
                  <ActionForm key={role} action={setStaffRole} className="flex items-center justify-between text-sm">
                    <input type="hidden" name="user_id" value={id} /><input type="hidden" name="role" value={role} /><input type="hidden" name="grant" value={String(!roleSet.has(role))} />
                    <span className="capitalize">{role}{roleSet.has(role) && " ✓"}</span>
                    <SubmitButton className="btn-ghost btn-sm" confirm={`${roleSet.has(role) ? "Remove" : "Grant"} ${role} role?`}>{roleSet.has(role) ? "Remove" : "Grant"}</SubmitButton>
                  </ActionForm>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
