import Link from "next/link";
import { MemberStatusBadge } from "@/components/badges";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/notices";
import { submitAppeal } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Account standing" };

export default async function Standing() {
  const v = await requireViewer("/dashboard/standing");
  const sb = await createClient();
  const [{ data: rel }, { data: warnings }, { data: appeals }, { data: noShows }] = await Promise.all([
    sb.rpc("member_reliability", { p_user: v.id }),
    sb.from("member_warnings").select("id,message,created_at").order("created_at", { ascending: false }),
    sb.from("appeals").select("id,explanation,status,decision_message,created_at,decided_at").order("created_at", { ascending: false }),
    sb.from("applications").select("id,events(title,starts_at)").eq("attendance", "unexcused_no_show"),
  ]);
  const r = (rel as { attended: number; no_shows: number; late_cancellations: number; cancelled_in_period: number; attendance_rate: number | null }[] | null)?.[0];
  const openAppeal = (appeals ?? []).find((a) => a.status === "submitted" || a.status === "under_review");
  const canAppeal = (v.status === "restricted" || v.status === "suspended") && !openAppeal;
  return (
    <div className="space-y-8">
      <PageHeader title="Account standing">Your standing is private — only you and administrators can see it.</PageHeader>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div><p className="text-sm text-muted">Membership status</p><div className="mt-1"><MemberStatusBadge status={v.status} /></div>
          {v.statusReason && <p className="mt-2 text-sm">{v.statusReason}</p>}</div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Attended</dt><dd className="font-display text-2xl">{r?.attended ?? 0}</dd></div>
          <div><dt className="text-muted">Cancelled in time</dt><dd className="font-display text-2xl">{r?.cancelled_in_period ?? 0}</dd></div>
          <div><dt className="text-muted">Late cancellations</dt><dd className="font-display text-2xl">{r?.late_cancellations ?? 0}</dd></div>
          <div><dt className="text-muted">No-shows</dt><dd className="font-display text-2xl">{r?.no_shows ?? 0}</dd></div>
        </dl>
      </section>
      {v.status === "active" && <Notice title="You're in good standing">Thanks for being reliable. Read the <Link href="/policies/attendance-policy" className="underline">attendance policy</Link> to keep it that way.</Notice>}
      {openAppeal && <Notice title="Your explanation is being reviewed">Submitted {formatDate(openAppeal.created_at)}. We&apos;ll notify you of the decision.</Notice>}
      {canAppeal && (
        <section className="card p-6">
          <h2 className="text-xl text-forest-950">Submit an explanation or appeal</h2>
          <p className="mt-1 text-sm text-muted">If something unexpected happened — an emergency, illness, a safety concern or an error on our side — tell us. Every explanation is reviewed by an administrator.</p>
          <ActionForm action={submitAppeal} className="mt-4 space-y-4">
            {(noShows ?? []).length > 0 && (
              <Field label="Related activity" htmlFor="application_id">
                <select id="application_id" name="application_id" className="input">
                  <option value="">General appeal</option>
                  {(noShows ?? []).map((n) => { const ev = n.events as unknown as { title: string; starts_at: string }; return <option key={n.id} value={n.id}>{ev.title} ({formatDate(ev.starts_at)})</option>; })}
                </select>
              </Field>
            )}
            <Field label="Your explanation" htmlFor="explanation" required><textarea id="explanation" name="explanation" rows={5} minLength={20} maxLength={3000} required className="input" /></Field>
            <SubmitButton>Submit explanation</SubmitButton>
          </ActionForm>
        </section>
      )}
      {(warnings ?? []).length > 0 && (
        <section><h2 className="text-xl text-forest-950">Notes from the community team</h2>
          <ul className="mt-3 space-y-2">{(warnings ?? []).map((w) => <li key={w.id} className="card p-4 text-sm"><p>{w.message}</p><p className="mt-1 text-xs text-muted">{formatDate(w.created_at)}</p></li>)}</ul></section>
      )}
      {(appeals ?? []).length > 0 && (
        <section><h2 className="text-xl text-forest-950">Appeal history</h2>
          <ul className="mt-3 space-y-2">{(appeals ?? []).map((a) => (
            <li key={a.id} className="card p-4 text-sm"><p className="font-medium capitalize">{a.status.replace("_", " ")} · {formatDate(a.created_at)}</p>
              <p className="mt-1 text-muted">{a.explanation}</p>{a.decision_message && <p className="mt-2"><strong>Decision:</strong> {a.decision_message}</p>}</li>))}</ul></section>
      )}
    </div>
  );
}
