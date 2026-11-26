import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { resolveReport } from "@/lib/actions/admin";
import { moderatePost } from "@/lib/actions/hub";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Moderation" };

export default async function Moderation() {
  const v = await requireStaff();
  if (!v.isModerator) redirect("/admin");
  const sb = await createClient();
  const [{ data: reports }, { data: hidden }] = await Promise.all([
    sb.from("content_reports").select("id,category,details,status,resolution_note,created_at,subject_user_id,event_id,post_id,events(title,slug),event_posts(body)").order("created_at", { ascending: false }).limit(100),
    sb.from("event_posts").select("id,body,hidden_reason,created_at,events(title,slug)").eq("hidden", true).order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title="Moderation">Private reports from members and hidden discussion posts. Reporter identities are visible to staff only and never shared with the reported member.</PageHeader>
      <section className="space-y-4">
        {(reports ?? []).map((r) => {
          const ev = r.events as unknown as { title: string; slug: string } | null;
          const post = r.event_posts as unknown as { body: string } | null;
          const open = ["open", "in_review"].includes(r.status);
          return (
            <article key={r.id} className={`card p-5 ${open && r.category === "safety" ? "ring-2 ring-ember-500/40" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="chip bg-ember-100 text-ember-700 capitalize">{r.category}</span><span className="text-xs text-muted">{formatDateTime(r.created_at)} · {r.status.replace("_", " ")}</span></div>
              <p className="mt-2 text-sm">{r.details}</p>
              <p className="mt-1 text-xs text-muted">{ev && <>Event: <Link href={`/activities/${ev.slug}/hub`} className="underline">{ev.title}</Link></>}{r.subject_user_id && v.isAdmin && <> · <Link href={`/admin/members/${r.subject_user_id}`} className="underline">Reported member</Link></>}</p>
              {post && <blockquote className="mt-2 rounded-lg bg-sand-50 p-3 text-sm">“{post.body}”</blockquote>}
              {r.resolution_note && <p className="mt-2 text-sm text-muted">Note: {r.resolution_note}</p>}
              {open && (
                <ActionForm action={resolveReport} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="report_id" value={r.id} />
                  <Field label="Internal note" htmlFor={`n-${r.id}`} className="min-w-60 flex-1"><input id={`n-${r.id}`} name="note" className="input py-1.5" /></Field>
                  <SubmitButton name="status" value="in_review" className="btn-secondary btn-sm">In review</SubmitButton>
                  <SubmitButton name="status" value="resolved" className="btn-primary btn-sm">Resolved</SubmitButton>
                  <SubmitButton name="status" value="dismissed" className="btn-ghost btn-sm">Dismiss</SubmitButton>
                </ActionForm>
              )}
            </article>
          );
        })}
        {(reports ?? []).length === 0 && <p className="card p-6 text-sm text-muted">No reports.</p>}
      </section>
      <section>
        <h2 className="text-xl text-forest-950">Hidden posts</h2>
        <ul className="mt-3 space-y-2">{(hidden ?? []).map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <span><span className="text-muted">{(p.events as unknown as { title: string }).title}:</span> {p.body.slice(0, 160)}</span>
            <form action={moderatePost}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="hidden" value="false" /><input type="hidden" name="path" value="/admin/moderation" /><button className="btn-ghost btn-sm">Restore</button></form>
          </li>))}
          {(hidden ?? []).length === 0 && <li className="text-sm text-muted">No hidden posts.</li>}</ul>
      </section>
    </div>
  );
}
