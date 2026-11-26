import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { deleteFaq, deleteHighlight, saveFaq, saveHighlight, saveHomepage, savePolicy } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { HomepageSettings } from "@/lib/types";

export const metadata = { title: "Content" };

export default async function Content({ searchParams }: PageProps<"/admin/content">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "faq";
  const sb = await createClient();
  const tabs = [["faq", "FAQ"], ["policies", "Policies"], ["homepage", "Homepage"], ["highlights", "Highlights"]];
  return (
    <div>
      <PageHeader title="Content">Everything here updates the public site immediately — no code changes needed. Markdown supported: **bold**, - lists, ## headings, [links](https://…).</PageHeader>
      <div className="mb-6 flex flex-wrap gap-2">{tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`btn btn-sm ${tab === k ? "bg-forest-800 text-white" : "bg-white ring-1 ring-forest-900/10"}`}>{l}</Link>)}</div>
      {tab === "faq" && <FaqTab sb={sb} />}
      {tab === "policies" && <PoliciesTab sb={sb} slug={typeof sp.slug === "string" ? sp.slug : undefined} />}
      {tab === "homepage" && <HomepageTab sb={sb} />}
      {tab === "highlights" && <HighlightsTab sb={sb} />}
    </div>
  );
}

type SB = Awaited<ReturnType<typeof createClient>>;

async function FaqTab({ sb }: { sb: SB }) {
  const { data } = await sb.from("faqs").select("*").order("sort_order");
  return (
    <div className="space-y-4">
      <div className="card p-5"><h2 className="mb-3 text-lg text-forest-950">Add a question</h2><FaqForm /></div>
      {(data ?? []).map((f) => (
        <details key={f.id} className="card p-5">
          <summary className="cursor-pointer font-medium text-forest-950">{f.question} <span className="text-xs text-muted">· {f.category}{!f.published && " · hidden"}</span></summary>
          <div className="mt-4"><FaqForm f={f} /></div>
          <form action={deleteFaq} className="mt-2"><input type="hidden" name="id" value={f.id} /><button className="btn-ghost btn-sm text-ember-700">Delete</button></form>
        </details>
      ))}
    </div>
  );
}

async function PoliciesTab({ sb, slug }: { sb: SB; slug?: string }) {
  const { data } = await sb.from("policy_pages").select("*").order("sort_order");
  const p = (data ?? []).find((x) => x.slug === slug) ?? (data ?? [])[0];
  if (!p) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ul className="space-y-1">{(data ?? []).map((x) => <li key={x.slug}><Link href={`?tab=policies&slug=${x.slug}`} className={`block rounded-lg px-3 py-2 text-sm ${x.slug === p.slug ? "bg-forest-800 text-white" : "hover:bg-forest-900/5"}`}>{x.title}{!x.legal_reviewed && " ⚠"}</Link></li>)}</ul>
      <ActionForm action={savePolicy} className="card space-y-3 p-6" key={p.slug}>
        <input type="hidden" name="slug" value={p.slug} />
        <Field label="Title" htmlFor="ptitle"><input id="ptitle" name="title" defaultValue={p.title} className="input" /></Field>
        <Field label="Summary" htmlFor="psum"><input id="psum" name="summary" defaultValue={p.summary ?? ""} className="input" /></Field>
        <Field label="Body (Markdown)" htmlFor="pbody"><textarea id="pbody" name="body" defaultValue={p.body} rows={20} className="input font-mono text-xs" /></Field>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={p.published} className="accent-forest-700" />Published</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="legal_reviewed" defaultChecked={p.legal_reviewed} className="accent-forest-700" />Reviewed by a lawyer (removes the draft banner)</label>
        </div>
        <div className="flex gap-2"><SubmitButton>Save policy</SubmitButton><Link href={`/policies/${p.slug}`} target="_blank" className="btn-ghost">View</Link></div>
      </ActionForm>
    </div>
  );
}

async function HomepageTab({ sb }: { sb: SB }) {
  const { data } = await sb.from("site_settings").select("value").eq("key", "homepage").single();
  const h = data?.value as HomepageSettings;
  return (
    <ActionForm action={saveHomepage} className="card space-y-4 p-6">
      <Field label="Hero headline" htmlFor="hero_title"><input id="hero_title" name="hero_title" defaultValue={h.hero_title} className="input" /></Field>
      <Field label="Hero subtitle" htmlFor="hero_subtitle"><textarea id="hero_subtitle" name="hero_subtitle" defaultValue={h.hero_subtitle} rows={2} className="input" /></Field>
      <Field label="Hero image URL" htmlFor="hero_image_url" hint="Upload via any event's editor, then paste the URL. Use landscape photos at least 2400px wide."><input id="hero_image_url" name="hero_image_url" defaultValue={h.hero_image_url} className="input" /></Field>
      <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="label">Community values (up to 4)</legend>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-xl bg-sand-50 p-3">
            <label htmlFor={`vt${i}`} className="sr-only">Value {i + 1} title</label><input id={`vt${i}`} name={`value_title_${i}`} defaultValue={h.values[i]?.title ?? ""} placeholder="Title" className="input" />
            <label htmlFor={`vb${i}`} className="sr-only">Value {i + 1} text</label><textarea id={`vb${i}`} name={`value_body_${i}`} defaultValue={h.values[i]?.body ?? ""} rows={2} placeholder="Description" className="input" />
          </div>
        ))}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-4"><legend className="label">Statistics overrides (leave blank to show live numbers)</legend>
        {[["members", "Active members"], ["events_completed", "Activities completed"], ["participations", "Spots filled"], ["km_travelled", "Km travelled"]].map(([k, l]) => (
          <Field key={k} label={l} htmlFor={`s-${k}`}><input id={`s-${k}`} name={`stat_${k}`} type="number" defaultValue={(h.stats_override as Record<string, number>)?.[k] ?? ""} className="input" /></Field>
        ))}
      </fieldset>
      <SubmitButton>Save homepage</SubmitButton>
    </ActionForm>
  );
}

async function HighlightsTab({ sb }: { sb: SB }) {
  const [{ data }, { data: events }] = await Promise.all([
    sb.from("highlights").select("*").order("sort_order"),
    sb.from("events").select("id,title").eq("status", "completed").order("starts_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-6">
      <ActionForm action={saveHighlight} className="card grid gap-3 p-6 sm:grid-cols-2" resetOnSuccess>
        <h2 className="text-lg text-forest-950 sm:col-span-2">Add a highlight</h2>
        <Field label="Title" htmlFor="htitle"><input id="htitle" name="title" required className="input" /></Field>
        <Field label="Event" htmlFor="hevent"><select id="hevent" name="event_id" className="input"><option value="">—</option>{(events ?? []).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>
        <Field label="Image URL" htmlFor="himg"><input id="himg" name="image_url" required className="input" /></Field>
        <Field label="Caption" htmlFor="hcap"><input id="hcap" name="caption" className="input" /></Field>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="consent_confirmed" className="mt-0.5 accent-forest-700" />I confirm every identifiable person in this photo has photo consent on file or has agreed to this specific use.</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" className="accent-forest-700" />Publish now</label>
        <SubmitButton className="btn-primary btn-sm">Save highlight</SubmitButton>
      </ActionForm>
      <ul className="grid gap-3 sm:grid-cols-2">{(data ?? []).map((h) => (
        <li key={h.id} className="card flex items-center justify-between gap-3 p-4 text-sm"><span><strong>{h.title}</strong><span className="block text-xs text-muted">{h.published ? "Published" : "Hidden"} · consent {h.consent_confirmed ? "confirmed" : "missing"}</span></span>
          <form action={deleteHighlight}><input type="hidden" name="id" value={h.id} /><button className="btn-ghost btn-sm text-ember-700">Remove</button></form></li>))}</ul>
    </div>
  );
}

function FaqForm({ f }: { f?: Record<string, unknown> }) {
  return (
    <ActionForm action={saveFaq} className="grid gap-3 sm:grid-cols-[1fr_140px_90px]" resetOnSuccess={!f}>
      {f && <input type="hidden" name="id" value={String(f.id)} />}
      <Field label="Question" htmlFor={`q-${f?.id ?? "new"}`}><input id={`q-${f?.id ?? "new"}`} name="question" defaultValue={(f?.question as string) ?? ""} required className="input" /></Field>
      <Field label="Category" htmlFor={`c-${f?.id ?? "new"}`}><input id={`c-${f?.id ?? "new"}`} name="category" defaultValue={(f?.category as string) ?? ""} className="input" /></Field>
      <Field label="Order" htmlFor={`o-${f?.id ?? "new"}`}><input id={`o-${f?.id ?? "new"}`} name="sort_order" type="number" defaultValue={(f?.sort_order as number) ?? 99} className="input" /></Field>
      <Field label="Answer" htmlFor={`a-${f?.id ?? "new"}`} className="sm:col-span-3"><textarea id={`a-${f?.id ?? "new"}`} name="answer" defaultValue={(f?.answer as string) ?? ""} rows={3} required className="input" /></Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={(f?.published as boolean) ?? true} className="accent-forest-700" />Published</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_on_home" defaultChecked={(f?.show_on_home as boolean) ?? false} className="accent-forest-700" />Show on homepage</label>
        <SubmitButton className="btn-primary btn-sm">{f ? "Save" : "Add FAQ"}</SubmitButton>
      </div>
    </ActionForm>
  
  );
}
