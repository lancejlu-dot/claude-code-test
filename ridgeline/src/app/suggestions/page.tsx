import { ExternalLink, ThumbsUp } from "lucide-react";
import { DifficultyBadge } from "@/components/badges";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { submitSuggestion, toggleVote } from "@/lib/actions/suggestions";
import { requireViewer } from "@/lib/auth";
import { getCategories } from "@/lib/data/public";
import { createClient } from "@/lib/supabase/server";
import type { Difficulty } from "@/lib/types";

export const metadata = { title: "Suggest an activity" };

const STATUS: Record<string, string> = { submitted: "New", under_review: "Under review", planned: "Being planned", converted: "Planned 🎉", declined: "Not this time" };

export default async function Suggestions() {
  const v = await requireViewer("/suggestions");
  const sb = await createClient();
  const [{ data }, categories] = await Promise.all([
    sb.from("suggestions").select("id,name,location,preferred_timing,difficulty,external_link,explanation,willing_to_help,status,admin_response,created_at,user_id,activity_categories(name),suggestion_votes(user_id)").order("created_at", { ascending: false }).limit(100),
    getCategories(),
  ]);
  const list = (data ?? []).map((s) => ({ ...s, votes: (s.suggestion_votes as { user_id: string }[]) }))
    .sort((a, b) => b.votes.length - a.votes.length);
  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_380px]">
      <div>
        <PageHeader eyebrow="Community ideas" title="Suggested activities">Vote for trips you&apos;d love to join. Organizers review popular ideas and turn them into events.</PageHeader>
        <ul className="space-y-4">
          {list.map((s) => {
            const voted = s.votes.some((x) => x.user_id === v.id);
            return (
              <li key={s.id} className="card flex gap-4 p-5">
                <form action={toggleVote} className="shrink-0">
                  <input type="hidden" name="suggestion_id" value={s.id} /><input type="hidden" name="voted" value={String(voted)} />
                  <button disabled={v.status !== "active"} aria-pressed={voted} aria-label={voted ? "Remove vote" : "Vote"}
                    className={`flex w-14 flex-col items-center rounded-xl py-2 text-sm font-semibold ring-1 ${voted ? "bg-forest-800 text-white ring-forest-800" : "bg-white text-forest-900 ring-forest-900/15 hover:bg-sand-100"}`}>
                    <ThumbsUp className="h-4 w-4" aria-hidden />{s.votes.length}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg text-forest-950">{s.name}</h2><span className="chip bg-sand-100">{STATUS[s.status]}</span></div>
                  <p className="text-sm text-muted">{[(s.activity_categories as unknown as { name: string } | null)?.name, s.location, s.preferred_timing].filter(Boolean).join(" · ")}</p>
                  {s.explanation && <p className="mt-2 text-sm">{s.explanation}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <DifficultyBadge difficulty={s.difficulty as Difficulty | null} />
                    {s.willing_to_help && <span className="chip bg-moss-100 text-forest-800">Suggester can help organize</span>}
                    {s.external_link && <a href={s.external_link} target="_blank" rel="noopener noreferrer" className="chip bg-lake-100 text-lake-700">Link <ExternalLink className="h-3 w-3" aria-hidden /></a>}
                  </div>
                  {s.admin_response && <p className="mt-2 rounded-lg bg-sand-100 p-2 text-sm"><strong>Organizers:</strong> {s.admin_response}</p>}
                </div>
              </li>
            );
          })}
          {list.length === 0 && <li className="text-sm text-muted">No suggestions yet — be the first!</li>}
        </ul>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ActionForm action={submitSuggestion} className="card space-y-4 p-6" resetOnSuccess>
          <h2 className="text-xl text-forest-950">Suggest an activity</h2>
          <Field label="Activity name" htmlFor="name" required><input id="name" name="name" required maxLength={120} className="input" /></Field>
          <Field label="Suggested location" htmlFor="location"><input id="location" name="location" className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="category_id"><select id="category_id" name="category_id" className="input"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Difficulty" htmlFor="difficulty"><select id="difficulty" name="difficulty" className="input"><option value="">—</option>{["easy", "moderate", "challenging", "strenuous", "expert"].map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}</select></Field>
          </div>
          <Field label="Preferred date or season" htmlFor="preferred_timing"><input id="preferred_timing" name="preferred_timing" className="input" /></Field>
          <Field label="Link (AllTrails, park page…)" htmlFor="external_link"><input id="external_link" name="external_link" type="url" className="input" /></Field>
          <Field label="Why this trip?" htmlFor="explanation"><textarea id="explanation" name="explanation" rows={3} maxLength={1000} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="willing_to_help" className="accent-forest-700" />I&apos;d be interested in helping organize it</label>
          <SubmitButton>Submit suggestion</SubmitButton>
        </ActionForm>
      </aside>
    </div>
  );
}
