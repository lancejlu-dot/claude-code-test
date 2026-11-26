import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { ICON_NAMES } from "@/components/icons";
import { Notice, PageHeader } from "@/components/notices";
import { saveBrand, saveCategory, saveGroup, saveRegion, saveSetting } from "@/lib/actions/admin";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HIDEABLE_FIELDS } from "@/lib/event-fields";
import { isEmailConfigured, isStripeConfigured } from "@/lib/env";
import type { BrandSettings, Category, Region } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: PageProps<"/admin/settings">) {
  await requireOwner();
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "general";
  const sb = await createClient();
  const tabs = [["general", "General"], ["regions", "Regions"], ["categories", "Categories"], ["groups", "Member groups"], ["integrations", "Integrations"]];
  return (
    <div>
      <PageHeader title="Platform settings">Owner-only configuration. Staff roles are managed from each member&apos;s page.</PageHeader>
      <div className="mb-6 flex flex-wrap gap-2">{tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`btn btn-sm ${tab === k ? "bg-forest-800 text-white" : "bg-white ring-1 ring-forest-900/10"}`}>{l}</Link>)}</div>
      {tab === "general" && <General sb={sb} />}
      {tab === "regions" && <Regions sb={sb} />}
      {tab === "categories" && <Categories sb={sb} />}
      {tab === "groups" && <Groups sb={sb} />}
      {tab === "integrations" && <Integrations sb={sb} />}
    </div>
  );
}

type SB = Awaited<ReturnType<typeof createClient>>;

async function General({ sb }: { sb: SB }) {
  const { data } = await sb.from("site_settings").select("key,value,description");
  const get = (k: string) => data?.find((d) => d.key === k)?.value;
  const brand = get("brand") as BrandSettings;
  const { data: waivers } = await sb.from("waiver_templates").select("id,title").eq("active", true);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={saveBrand} className="card space-y-3 p-5 lg:col-span-2">
        <p className="font-semibold text-forest-950">Brand</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Community name" htmlFor="bname"><input id="bname" name="name" defaultValue={brand.name} className="input" /></Field>
          <Field label="Contact email" htmlFor="bmail"><input id="bmail" name="contact_email" type="email" defaultValue={brand.contact_email} className="input" /></Field>
          <Field label="Tagline" htmlFor="btag"><input id="btag" name="tagline" defaultValue={brand.tagline} className="input" /></Field>
          <Field label="Region label" htmlFor="breg"><input id="breg" name="region_label" defaultValue={brand.region_label} className="input" /></Field>
        </div>
        <SubmitButton className="btn-primary btn-sm">Save brand</SubmitButton>
      </ActionForm>
      <Setting get={get} k="require_member_approval" label="New member approval">{(v) => (
        <select name="value" defaultValue={String(v)} className="input" aria-label="Approval mode"><option value="true">Require manual approval</option><option value="false">Approve automatically</option></select>)}</Setting>
      <Setting get={get} k="default_cancellation_hours" label="Default free-cancellation window (hours before start)">{(v) => <input name="value" type="number" min={0} defaultValue={String(v)} className="input" aria-label="Hours" />}</Setting>
      <Setting get={get} k="general_waiver_template_id" label="General community waiver (required for every activity)">{(v) => (
        <select name="value" defaultValue={JSON.stringify(v)} className="input" aria-label="General waiver"><option value="null">None</option>{(waivers ?? []).map((w) => <option key={w.id} value={JSON.stringify(w.id)}>{w.title}</option>)}</select>)}</Setting>
      <Setting get={get} k="site_url" label="Public site URL (used in emails)">{(v) => <input name="value" defaultValue={JSON.stringify(v)} className="input font-mono text-sm" aria-label="URL as JSON string" />}</Setting>
      <Setting get={get} k="retention" label="Data retention (days)">{(v) => (
        <><textarea name="value" rows={7} defaultValue={JSON.stringify(v, null, 2)} className="input font-mono text-xs" aria-label="Retention JSON" />
          <p className="text-xs text-muted">Read notifications, sent emails, audit entries and old event discussions are purged automatically after these windows. Waiver and payment records are retained per legal requirements.</p></>)}</Setting>
    </div>
  );
}

async function Regions({ sb }: { sb: SB }) {
  const { data } = await sb.from("regions").select("*").order("kind").order("sort_order");
  const regions = (data ?? []) as (Region & { time_zone: string; currency: string })[];
  return (
    <div className="space-y-4">
      <Notice>Regions are hierarchical (country → province → area). Filtering by a country or province includes all areas inside it, so you can expand to new regions without redesigning anything.</Notice>
      <div className="card p-5"><p className="mb-2 font-semibold text-forest-950">Add region</p><RegionForm regions={regions} /></div>
      <div className="card divide-y divide-forest-900/5 p-5">{regions.map((r) => <div key={r.id} className="py-2"><RegionForm r={r} regions={regions} /></div>)}</div>
    </div>
  );
}

async function Categories({ sb }: { sb: SB }) {
  const { data } = await sb.from("activity_categories").select("*").order("sort_order");
  return (
    <div className="space-y-4">
      <div className="card p-5"><p className="mb-2 font-semibold text-forest-950">Add category</p><CategoryForm /></div>
      {((data ?? []) as Category[]).map((c) => <details key={c.id} className="card p-5"><summary className="cursor-pointer font-medium">{c.name}{!c.active && " (inactive)"}</summary><div className="mt-3"><CategoryForm c={c} /></div></details>)}
    </div>
  );
}

async function Groups({ sb }: { sb: SB }) {
  const { data } = await sb.from("member_groups").select("id,name,description,member_group_members(count)");
  return (
    <div className="space-y-4">
      <ActionForm action={saveGroup} className="card grid items-end gap-3 p-5 sm:grid-cols-[1fr_2fr_auto]" resetOnSuccess>
        <Field label="Group name" htmlFor="gname"><input id="gname" name="name" required className="input" /></Field>
        <Field label="Description" htmlFor="gdesc"><input id="gdesc" name="description" className="input" /></Field>
        <SubmitButton className="btn-primary btn-sm">Create group</SubmitButton>
      </ActionForm>
      <ul className="card divide-y divide-forest-900/5">{(data ?? []).map((g) => <li key={g.id} className="p-4 text-sm"><strong>{g.name}</strong> · {(g.member_group_members as unknown as { count: number }[])[0]?.count ?? 0} members<span className="block text-muted">{g.description}</span></li>)}</ul>
      <p className="text-sm text-muted">Add members to groups from each member&apos;s page. Groups can receive targeted announcements.</p>
    </div>
  );
}

async function Integrations({ sb }: { sb: SB }) {
  const { data: outbox } = await sb.from("email_outbox").select("status");
  const counts = (outbox ?? []).reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  return (
    <div className="space-y-4">
      <div className="card divide-y divide-forest-900/5">
        <Row name="Supabase (database, auth, storage)" on detail="Connected. Enable daily backups / point-in-time recovery in the Supabase dashboard." />
        <Row name="Stripe (online payments)" on={isStripeConfigured()} detail="STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Without them, online payment options are hidden from members." />
        <Row name="Resend (transactional email)" on={isEmailConfigured()} detail="RESEND_API_KEY, EMAIL_FROM. Without them, emails stay queued and are never reported as sent." />
        <Row name="Scheduled jobs" on={Boolean(process.env.CRON_SECRET)} detail="CRON_SECRET + vercel.json cron → /api/cron/jobs every 15 minutes (offers, reminders, email delivery)." />
      </div>
      <div className="card p-5 text-sm"><p className="font-semibold text-forest-950">Email outbox</p>
        <p className="mt-1 text-muted">{Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" · ") || "Empty"}</p></div>
    </div>
  );
}

function Setting({ k, label, get, children }: { k: string; label: string; get: (k: string) => unknown; children: (v: unknown) => React.ReactNode }) {
  return (
    <ActionForm action={saveSetting} className="card space-y-3 p-5"><input type="hidden" name="key" value={k} /><p className="font-semibold text-forest-950">{label}</p>{children(get(k))}<SubmitButton className="btn-primary btn-sm">Save</SubmitButton></ActionForm>
  );
}

function RegionForm({ r, regions }: { r?: Region & { time_zone: string; currency: string }; regions: (Region & { time_zone: string; currency: string })[] }) {
  return (
    <ActionForm action={saveRegion} className="grid items-end gap-2 sm:grid-cols-[1fr_140px_1fr_80px_auto_auto]" resetOnSuccess={!r}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <Field label="Name" htmlFor={`rn-${r?.id ?? "new"}`}><input id={`rn-${r?.id ?? "new"}`} name="name" defaultValue={r?.name} className="input py-1.5" /></Field>
      <Field label="Type" htmlFor={`rk-${r?.id ?? "new"}`}><select id={`rk-${r?.id ?? "new"}`} name="kind" defaultValue={r?.kind ?? "area"} className="input py-1.5"><option value="area">Area</option><option value="province">Province / state</option><option value="country">Country</option></select></Field>
      <Field label="Parent" htmlFor={`rp-${r?.id ?? "new"}`}><select id={`rp-${r?.id ?? "new"}`} name="parent_id" defaultValue={r?.parent_id ?? ""} className="input py-1.5"><option value="">—</option>{regions.filter((x) => x.kind !== "area" && x.id !== r?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Order" htmlFor={`ro-${r?.id ?? "new"}`}><input id={`ro-${r?.id ?? "new"}`} name="sort_order" type="number" defaultValue={r?.sort_order ?? 99} className="input py-1.5" /></Field>
      <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} className="accent-forest-700" />Active</label>
      <input type="hidden" name="slug" value={r?.slug ?? ""} /><input type="hidden" name="time_zone" value={r?.time_zone ?? "America/Vancouver"} /><input type="hidden" name="currency" value={r?.currency ?? "CAD"} />
      <SubmitButton className="btn-secondary btn-sm">{r ? "Save" : "Add"}</SubmitButton>
    </ActionForm>
  
  );
}

function CategoryForm({ c }: { c?: Category }) {
  return (
    <ActionForm action={saveCategory} className="space-y-3" resetOnSuccess={!c}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-2 sm:grid-cols-[1fr_160px_80px]">
        <Field label="Name" htmlFor={`cn-${c?.id ?? "new"}`}><input id={`cn-${c?.id ?? "new"}`} name="name" defaultValue={c?.name} className="input py-1.5" /></Field>
        <Field label="Icon" htmlFor={`ci-${c?.id ?? "new"}`}><select id={`ci-${c?.id ?? "new"}`} name="icon" defaultValue={c?.icon ?? "mountain"} className="input py-1.5">{ICON_NAMES.map((i) => <option key={i}>{i}</option>)}</select></Field>
        <Field label="Order" htmlFor={`co-${c?.id ?? "new"}`}><input id={`co-${c?.id ?? "new"}`} name="sort_order" type="number" defaultValue={c?.sort_order ?? 99} className="input py-1.5" /></Field>
      </div>
      <Field label="Description" htmlFor={`cd-${c?.id ?? "new"}`}><input id={`cd-${c?.id ?? "new"}`} name="description" defaultValue={c?.description ?? ""} className="input py-1.5" /></Field>
      <fieldset><legend className="label">Fields hidden by default for new events</legend>
        <div className="grid gap-1 text-xs sm:grid-cols-3">{HIDEABLE_FIELDS.map((f) => <label key={f.key} className="flex items-center gap-1.5"><input type="checkbox" name="hidden_fields" value={f.key} defaultChecked={c?.hidden_fields.includes(f.key)} className="accent-forest-700" />{f.label}</label>)}</div></fieldset>
      <div className="flex items-center gap-4"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="tracks_distance" defaultChecked={c?.tracks_distance ?? true} className="accent-forest-700" />Counts toward member distance totals</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="accent-forest-700" />Active</label>
        <input type="hidden" name="slug" value={c?.slug ?? ""} /><SubmitButton className="btn-secondary btn-sm">{c ? "Save" : "Add category"}</SubmitButton></div>
    </ActionForm>
  
  );
}

function Row({ name, on, detail }: { name: string; on: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 p-5"><div><p className="font-semibold text-forest-950">{name}</p><p className="text-sm text-muted">{detail}</p></div>
      <span className={`chip ${on ? "bg-moss-100 text-forest-800" : "bg-ember-100 text-ember-700"}`}>{on ? "Configured" : "Not configured"}</span></div>
  
  );
}
