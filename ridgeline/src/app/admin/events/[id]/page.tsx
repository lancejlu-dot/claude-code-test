import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { EventStatusBadge } from "@/components/badges";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/notices";
import { eventLifecycle } from "@/lib/actions/admin";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EventListing } from "@/lib/types";
import { EventForm } from "../event-form";
import { getEventFormData } from "../data";
import { ImageUploader } from "../image-uploader";

export const metadata = { title: "Edit event" };

export default async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const v = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const sb = await createClient();
  const [{ data: e }, { data: priv }, { data: ew }, { data: orgs }, d] = await Promise.all([
    sb.from("event_listing").select("*").eq("id", id).maybeSingle(),
    sb.from("event_private_details").select("*").eq("event_id", id).maybeSingle(),
    sb.from("event_waivers").select("template_id").eq("event_id", id),
    sb.from("event_organizers").select("user_id,is_lead").eq("event_id", id),
    getEventFormData(v.isAdmin),
  ]);
  if (!e) notFound();
  const ev = e as EventListing;
  return (
    <div>
      <PageHeader eyebrow="Event" title={ev.title} actions={<>
        <Link href={`/admin/events/${ev.id}/applications`} className="btn-primary btn-sm">Applicants</Link>
        <Link href={`/admin/events/${ev.id}/roster`} className="btn-secondary btn-sm">Event-day roster</Link>
        {ev.status !== "draft" && <Link href={`/activities/${ev.slug}`} className="btn-ghost btn-sm" target="_blank">View public page<ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>}
      </>}>
        <span className="inline-flex items-center gap-2"><EventStatusBadge status={ev.public_status} /> {ev.spots_taken}/{ev.max_participants} selected · {ev.waitlist_count} waitlisted</span>
      </PageHeader>
      <div className="space-y-3">
        {sp.created && <Notice title="Draft created">Review the details, then publish when you&apos;re ready.</Notice>}
        {sp.duplicated && <Notice title="Duplicated">This is a new draft copy. Update the date before publishing.</Notice>}
        {sp.from_suggestion && <Notice title="Created from a member suggestion">Fill in the details — the suggester has been told it&apos;s being planned.</Notice>}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_280px]">
        <EventForm e={ev} priv={priv} categories={d.categories} regions={d.regions} waiverTemplates={d.waiverTemplates}
          selectedWaivers={(ew ?? []).map((w) => w.template_id)} staff={d.staff} organizers={orgs ?? []} />
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="card space-y-3 p-5">
            <p className="font-semibold text-forest-950">Status</p>
            {(ev.status === "draft" || ev.status === "postponed") && <Op id={ev.id} op="publish" label={ev.status === "postponed" ? "Re-publish (new date set)" : "Publish"} cls="btn-accent btn-sm w-full" />}
            {ev.status === "published" && (ev.registration_open ? <Op id={ev.id} op="close" label="Close registration" /> : <Op id={ev.id} op="open" label="Reopen registration" />)}
            {ev.status === "published" && (
              <details><summary className="cursor-pointer text-sm font-medium">Postpone…</summary>
                <Op id={ev.id} op="postpone" label="Postpone event" confirm="Postpone and notify applicants?"><Field label="Message to applicants" htmlFor="pnote"><textarea id="pnote" name="note" rows={2} className="input" /></Field></Op></details>
            )}
            {["published", "postponed", "draft"].includes(ev.status) && (
              <details><summary className="cursor-pointer text-sm font-medium text-ember-700">Cancel…</summary>
                <Op id={ev.id} op="cancel" label="Cancel event" cls="btn-danger btn-sm" confirm="Cancel this event and notify everyone?">
                  <Field label="Reason (sent to applicants)" htmlFor="cnote"><textarea id="cnote" name="note" rows={2} className="input" /></Field>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="weather" className="accent-forest-700" />Weather-related</label>
                </Op></details>
            )}
            {ev.status === "published" && <Op id={ev.id} op="complete" label="Mark completed" />}
            {v.isAdmin && <Op id={ev.id} op="duplicate" label="Duplicate" cls="btn-ghost btn-sm" />}
            {v.isAdmin && <Op id={ev.id} op="delete" label="Delete" cls="btn-ghost btn-sm text-ember-700" confirm="Delete permanently? Only possible if there are no applications." />}
            <p className="text-xs text-muted">Events with applications can&apos;t be deleted — cancel them instead so records are kept.</p>
          </div>
          <ImageUploader />
        </aside>
      </div>
    </div>
  );
}

function Op({ id, op, label, cls = "btn-secondary btn-sm", confirm, children }: { id: string; op: string; label: string; cls?: string; confirm?: string; children?: React.ReactNode }) {
  return (
    <ActionForm action={eventLifecycle} className="space-y-2">
      <input type="hidden" name="event_id" value={id} /><input type="hidden" name="op" value={op} />
      {children}
      <SubmitButton className={cls} confirm={confirm}>{label}</SubmitButton>
    </ActionForm>
  );
}
