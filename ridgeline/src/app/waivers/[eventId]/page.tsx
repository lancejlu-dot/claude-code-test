import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { LegalReviewNotice } from "@/components/notices";
import { signWaiver } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign waivers" };

export default async function WaiversPage({ params }: PageProps<"/waivers/[eventId]">) {
  const { eventId } = await params;
  await requireViewer(`/waivers/${eventId}`);
  const sb = await createClient();
  const { data: ev } = await sb.from("events").select("id,title,slug").eq("id", eventId).maybeSingle();
  if (!ev) notFound();
  const { data: required } = await sb.rpc("event_required_waivers", { p_event: eventId });
  const ids = ((required ?? []) as unknown as string[]).map((r) => (typeof r === "string" ? r : (r as Record<string, string>).event_required_waivers));
  const [{ data: templates }, { data: missing }] = await Promise.all([
    sb.from("waiver_templates").select("id,title,description,current_version,legal_reviewed,waiver_versions(version,body,change_summary)").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    sb.rpc("missing_waivers", { p_event: eventId }),
  ]);
  const missingIds = new Set(((missing ?? []) as { template_id: string }[]).map((m) => m.template_id));

  return (
    <div className="container-page max-w-3xl py-12">
      <Link href="/dashboard/activities" className="text-sm text-lake-700 hover:underline">← Back to my activities</Link>
      <h1 className="mt-4 text-3xl text-forest-950 sm:text-4xl">Waivers for {ev.title}</h1>
      <p className="mt-2 text-muted">Read each document carefully. You sign by typing your full name exactly as it appears on your account. We record the date, time, version and device information.</p>
      {missingIds.size === 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-moss-100 p-4 text-forest-800"><CircleCheck className="h-5 w-5" aria-hidden />
          All required waivers are signed. <Link href="/dashboard/activities" className="font-semibold underline">Continue to confirm your place</Link></div>
      )}
      <div className="mt-8 space-y-10">
        {(templates ?? []).map((t) => {
          const v = (t.waiver_versions as { version: number; body: string; change_summary: string | null }[]).find((x) => x.version === t.current_version);
          const needs = missingIds.has(t.id);
          return (
            <section key={t.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-forest-900/5 bg-sand-50 px-6 py-4">
                <div><h2 className="text-xl text-forest-950">{t.title}</h2><p className="text-xs text-muted">Version {t.current_version}{v?.change_summary && t.current_version > 1 ? ` · Changed: ${v.change_summary}` : ""}</p></div>
                {needs ? <span className="chip bg-ember-100 text-ember-700">Signature needed</span> : <span className="chip bg-moss-100 text-forest-800">Signed</span>}
              </div>
              {needs && (
                <div className="space-y-5 p-6">
                  {!t.legal_reviewed && <LegalReviewNotice what="This waiver" />}
                  <div className="max-h-96 overflow-y-auto rounded-xl bg-sand-50 p-5 ring-1 ring-forest-900/10" tabIndex={0} aria-label={`${t.title} text`}>
                    <Markdown source={v?.body ?? ""} />
                  </div>
                  <ActionForm action={signWaiver} className="space-y-4">
                    <input type="hidden" name="template_id" value={t.id} />
                    <input type="hidden" name="event_id" value={eventId} />
                    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 accent-forest-700" />
                      I have read and understood this document, and I agree to it voluntarily.</label>
                    <Field label="Type your full name to sign" htmlFor={`sig-${t.id}`}><input id={`sig-${t.id}`} name="signature_name" required autoComplete="name" className="input font-display text-lg" /></Field>
                    <SubmitButton pendingText="Signing…">Sign electronically</SubmitButton>
                  </ActionForm>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
