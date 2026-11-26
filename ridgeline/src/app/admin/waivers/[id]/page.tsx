import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { LegalReviewNotice, PageHeader } from "@/components/notices";
import { publishWaiverVersion, setWaiverReviewed } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Waiver" };

export default async function WaiverDetail({ params }: PageProps<"/admin/waivers/[id]">) {
  const v = await requireAdmin();
  const { id } = await params;
  const sb = await createClient();
  const [{ data: t }, { data: versions }, { data: sigs }] = await Promise.all([
    sb.from("waiver_templates").select("*").eq("id", id).maybeSingle(),
    sb.from("waiver_versions").select("id,version,body,change_summary,requires_resign,created_at").eq("template_id", id).order("version", { ascending: false }),
    sb.from("waiver_signatures").select("id,version,signed_at,signature_name,ip_address,profiles!waiver_signatures_user_id_fkey(first_name,last_initial),events(title)").eq("template_id", id).order("signed_at", { ascending: false }).limit(200),
  ]);
  if (!t) notFound();
  const current = (versions ?? [])[0];
  return (
    <div className="space-y-6">
      <Link href="/admin/waivers" className="text-sm text-lake-700 hover:underline">← Waivers</Link>
      <PageHeader title={t.title} actions={v.isOwner && (
        <form action={setWaiverReviewed}><input type="hidden" name="template_id" value={id} /><input type="hidden" name="reviewed" value={String(!t.legal_reviewed)} />
          <button className={t.legal_reviewed ? "btn-secondary btn-sm" : "btn-accent btn-sm"}>{t.legal_reviewed ? "Mark as needing review" : "Mark legally reviewed (current version)"}</button></form>)}>
        <span className="capitalize">{t.kind}</span> waiver · version {t.current_version}
      </PageHeader>
      {!t.legal_reviewed && <LegalReviewNotice what="This waiver" />}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6"><h2 className="text-lg text-forest-950">Current text (v{current?.version})</h2><div className="mt-3 max-h-[480px] overflow-y-auto"><Markdown source={current?.body ?? ""} /></div></section>
        <section className="card p-6">
          <h2 className="text-lg text-forest-950">Publish a new version</h2>
          <p className="text-sm text-muted">Versions are immutable. Existing signatures stay valid unless you require re-signing.</p>
          <ActionForm action={publishWaiverVersion} className="mt-3 space-y-3">
            <input type="hidden" name="template_id" value={id} />
            <Field label="Waiver text" htmlFor="body"><textarea id="body" name="body" rows={12} defaultValue={current?.body} className="input font-mono text-xs" /></Field>
            <Field label="What changed?" htmlFor="summary"><input id="summary" name="summary" required className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requires_resign" defaultChecked className="accent-forest-700" />Material change — members must re-sign</label>
            <SubmitButton confirm="Publish a new version?">Publish version {t.current_version + 1}</SubmitButton>
          </ActionForm>
        </section>
      </div>
      <section className="card p-6">
        <h2 className="text-lg text-forest-950">Version history</h2>
        <ul className="mt-2 divide-y divide-forest-900/5 text-sm">{(versions ?? []).map((x) => <li key={x.id} className="py-2">v{x.version} · {formatDateTime(x.created_at)} · {x.change_summary}{x.requires_resign && <span className="chip ml-2 bg-ember-100 text-ember-700">Re-sign required</span>}</li>)}</ul>
      </section>
      <section className="card overflow-x-auto p-6">
        <h2 className="text-lg text-forest-950">Signed records</h2>
        <table className="mt-3 w-full text-left text-sm"><thead className="text-xs text-muted uppercase"><tr><th className="py-2">Member</th><th>Version</th><th>Signed</th><th>Event</th><th /></tr></thead>
          <tbody className="divide-y divide-forest-900/5">{(sigs ?? []).map((s) => { const p = s.profiles as unknown as { first_name: string; last_initial: string }; return (
            <tr key={s.id}><td className="py-2">{p.first_name} {p.last_initial}. <span className="text-muted">(“{s.signature_name}”)</span></td><td>v{s.version}</td><td>{formatDateTime(s.signed_at)}</td><td>{(s.events as unknown as { title: string } | null)?.title ?? "—"}</td>
              <td className="text-right"><a href={`/api/waivers/${s.id}/pdf`} className="text-lake-700 underline">Download PDF</a></td></tr>); })}</tbody></table>
      </section>
    </div>
  );
}
