import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/notices";
import { applyToEvent } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";
import { getEventBySlug } from "@/lib/data/public";
import { getMyApplication } from "@/lib/data/member";
import { experienceLabel, formatDateTime } from "@/lib/format";

export const metadata = { title: "Apply" };

export default async function ApplyPage({ params }: PageProps<"/activities/[slug]/apply">) {
  const { slug } = await params;
  const viewer = await requireViewer(`/activities/${slug}/apply`);
  const e = await getEventBySlug(slug);
  if (!e) notFound();
  const existing = await getMyApplication(e.id, viewer.id);
  if (existing && !(existing.status === "cancelled" && !existing.attendance)) redirect("/dashboard/activities");
  const open = e.public_status === "open" || e.public_status === "waitlist";

  return (
    <div className="container-page max-w-3xl py-12">
      <Link href={`/activities/${e.slug}`} className="text-sm text-lake-700 hover:underline">← Back to activity</Link>
      <p className="eyebrow mt-6">Application</p>
      <h1 className="mt-1 text-3xl text-forest-950 sm:text-4xl">{e.title}</h1>
      <p className="mt-2 text-muted">{formatDateTime(e.starts_at, e.time_zone)} · {e.general_location}</p>

      <div className="mt-6 space-y-3">
        {viewer.status !== "active" && <Notice tone="warn">Your account isn&apos;t able to apply right now ({viewer.status}).</Notice>}
        {!open && <Notice tone="warn">This activity isn&apos;t accepting applications.</Notice>}
        {e.public_status === "waitlist" && <Notice>This activity is full. Your application will be considered for the waitlist.</Notice>}
        <Notice>Applying doesn&apos;t guarantee a place. Organizers select participants using activity-related criteria: experience for the
          difficulty, reliability, equipment readiness, your answers below and fair rotation.</Notice>
      </div>

      <ActionForm action={applyToEvent} className="mt-8 space-y-8">
        <input type="hidden" name="event_id" value={e.id} />
        <section className="card space-y-5 p-6">
          <h2 className="text-xl text-forest-950">Experience</h2>
          <p className="text-sm text-muted">Required: <strong>{experienceLabel[e.required_experience]}</strong>{e.fitness_expectations ? ` · ${e.fitness_expectations}` : ""}</p>
          <Field label="Your relevant experience" htmlFor="experience" hint="Similar trips, conditions you're comfortable with, anything the organizer should know.">
            <textarea id="experience" name="experience" rows={3} className="input" maxLength={1000} />
          </Field>
          {e.application_questions.map((q) => (
            <Field key={q.id} label={q.label} htmlFor={`q_${q.id}`} required={q.required} hint={q.help}>
              {q.type === "yesno" ? (
                <div className="flex gap-4 pt-1">
                  {["yes", "no"].map((v) => <label key={v} className="flex items-center gap-2 text-sm"><input type="radio" name={`q_${q.id}`} value={v} required={q.required} className="accent-forest-700" />{v === "yes" ? "Yes" : "No"}</label>)}
                </div>
              ) : <textarea id={`q_${q.id}`} name={`q_${q.id}`} rows={2} required={q.required} className="input" maxLength={1000} />}
            </Field>
          ))}
        </section>

        {e.required_equipment.length > 0 && (
          <fieldset className="card space-y-3 p-6">
            <legend className="sr-only">Equipment</legend>
            <h2 className="text-xl text-forest-950">Equipment check</h2>
            <p className="text-sm text-muted">Tick what you already have. Being honest helps organizers — gaps can often be solved with rentals or loans.</p>
            {e.required_equipment.map((it) => (
              <label key={it} className="flex items-start gap-3 text-sm"><input type="checkbox" name="equipment" value={it} className="mt-0.5 h-4 w-4 accent-forest-700" />{it}</label>
            ))}
          </fieldset>
        )}

        <section className="card space-y-5 p-6">
          <h2 className="text-xl text-forest-950">Logistics</h2>
          {e.carpool_enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Would you like a carpool seat?" htmlFor="wants_carpool">
                <select id="wants_carpool" name="wants_carpool" className="input"><option value="">No preference</option><option value="yes">Yes, I need a ride</option><option value="no">No, I&apos;ll get there myself</option></select>
              </Field>
              <Field label="Seats you could offer as a driver" htmlFor="can_drive_seats"><input id="can_drive_seats" name="can_drive_seats" type="number" min={0} max={7} className="input" /></Field>
            </div>
          )}
          <Field label="Note to the organizer (optional)" htmlFor="note"><textarea id="note" name="note" rows={2} maxLength={600} className="input" /></Field>
        </section>

        <SubmitButton className="btn-accent px-6 py-3" pendingText="Submitting…">{e.public_status === "waitlist" ? "Apply for the waitlist" : "Submit application"}</SubmitButton>
      </ActionForm>
    </div>
  );
}
