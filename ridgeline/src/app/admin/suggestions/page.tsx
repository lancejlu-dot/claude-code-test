import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { convertSuggestion, respondSuggestion } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Suggestions" };

export default async function AdminSuggestions() {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("suggestions").select("id,name,location,preferred_timing,difficulty,external_link,explanation,willing_to_help,status,admin_response,converted_event_id,created_at,profiles!suggestions_user_id_fkey(first_name,last_initial),activity_categories(name),suggestion_votes(count)").order("created_at", { ascending: false });
  const rows = (data ?? []).map((s) => ({ ...s, votes: (s.suggestion_votes as unknown as { count: number }[])[0]?.count ?? 0 })).sort((a, b) => b.votes - a.votes);
  return (
    <div>
      <PageHeader title="Member suggestions">Sorted by votes. Convert a suggestion into a draft event in one click.</PageHeader>
      <div className="space-y-4">
        {rows.map((s) => {
          const by = s.profiles as unknown as { first_name: string; last_initial: string } | null;
          return (
            <article key={s.id} className="card grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
              <div>
                <p className="font-display text-lg text-forest-950">{s.name} <span className="chip ml-1 bg-moss-100 text-forest-800">{s.votes} votes</span></p>
                <p className="text-sm text-muted">{[(s.activity_categories as unknown as { name: string } | null)?.name, s.location, s.preferred_timing, s.difficulty].filter(Boolean).join(" · ")}</p>
                {s.explanation && <p className="mt-2 text-sm">{s.explanation}</p>}
                <p className="mt-2 text-xs text-muted">By {by ? `${by.first_name} ${by.last_initial}.` : "former member"} · {formatDate(s.created_at)}{s.willing_to_help && " · willing to help organize"}{s.external_link && <> · <a href={s.external_link} target="_blank" rel="noopener noreferrer" className="underline">link</a></>}</p>
              </div>
              <div className="space-y-3">
                {s.converted_event_id ? <Link href={`/admin/events/${s.converted_event_id}`} className="btn-secondary btn-sm">Open draft event</Link> : (
                  <ActionForm action={convertSuggestion}><input type="hidden" name="suggestion_id" value={s.id} /><SubmitButton className="btn-accent btn-sm">Convert to draft event</SubmitButton></ActionForm>
                )}
                <ActionForm action={respondSuggestion} className="space-y-2">
                  <input type="hidden" name="suggestion_id" value={s.id} />
                  <Field label="Status" htmlFor={`st-${s.id}`}><select id={`st-${s.id}`} name="status" defaultValue={s.status} className="input py-1.5 text-sm">{["submitted", "under_review", "planned", "converted", "declined"].map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</select></Field>
                  <Field label="Public response" htmlFor={`r-${s.id}`}><input id={`r-${s.id}`} name="admin_response" defaultValue={s.admin_response ?? ""} className="input py-1.5 text-sm" /></Field>
                  <SubmitButton className="btn-ghost btn-sm">Save</SubmitButton>
                </ActionForm>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
