import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { decideAppeal } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Appeals" };

export default async function Appeals() {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("appeals").select("id,user_id,explanation,status,decision_message,created_at,decided_at,profiles!appeals_user_id_fkey(first_name,last_initial,status,status_reason),applications(events(title,starts_at))").order("created_at", { ascending: false }).limit(100);
  type A = { id: string; user_id: string; explanation: string; status: string; decision_message: string | null; created_at: string; decided_at: string | null;
    profiles: { first_name: string; last_initial: string; status: string; status_reason: string | null }; applications: { events: { title: string; starts_at: string } } | null };
  const rows = (data ?? []) as unknown as A[];
  const open = rows.filter((a) => ["submitted", "under_review"].includes(a.status));
  const closed = rows.filter((a) => !open.includes(a));
  return (
    <div className="space-y-8">
      <PageHeader title="Appeals & explanations">Restricted or suspended members can explain what happened. Decisions are private to the member.</PageHeader>
      <div className="space-y-4">
        {open.length === 0 && <p className="card p-6 text-sm text-muted">No open appeals. 🎉</p>}
        {open.map((a) => (
          <article key={a.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/admin/members/${a.user_id}`} className="font-semibold text-forest-950 hover:underline">{a.profiles.first_name} {a.profiles.last_initial}.</Link>
              <span className="text-xs text-muted">{formatDateTime(a.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{a.profiles.status_reason}{a.applications ? ` · ${a.applications.events.title} (${formatDate(a.applications.events.starts_at)})` : ""}</p>
            <blockquote className="mt-3 rounded-xl bg-sand-50 p-4 text-sm">{a.explanation}</blockquote>
            <ActionForm action={decideAppeal} className="mt-4 space-y-3">
              <input type="hidden" name="appeal_id" value={a.id} />
              <Field label="Message to the member" htmlFor={`m-${a.id}`}><textarea id={`m-${a.id}`} name="message" rows={2} className="input" placeholder="e.g. Thanks for explaining — we've restored your access. Please cancel through the app if plans change." /></Field>
              <div className="flex gap-2">
                <SubmitButton name="decision" value="approve" className="btn-accent btn-sm">Approve & restore access</SubmitButton>
                <SubmitButton name="decision" value="reject" className="btn-secondary btn-sm" confirm="Decline this appeal?">Decline</SubmitButton>
              </div>
            </ActionForm>
          </article>
        ))}
      </div>
      {closed.length > 0 && (
        <section><h2 className="text-xl text-forest-950">Decided</h2>
          <ul className="card mt-3 divide-y divide-forest-900/5 text-sm">{closed.map((a) => (
            <li key={a.id} className="p-4"><span className="font-medium">{a.profiles.first_name} {a.profiles.last_initial}.</span> · <span className="capitalize">{a.status}</span> · {a.decided_at ? formatDate(a.decided_at) : ""}{a.decision_message && <p className="text-muted">{a.decision_message}</p>}</li>))}</ul>
        </section>
      )}
    </div>
  );
}
