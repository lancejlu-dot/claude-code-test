import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { saveEvent } from "@/lib/actions/admin";
import { HIDEABLE_FIELDS } from "@/lib/event-fields";
import { isoToLocalInput } from "@/lib/time";
import type { Category, EventPrivateDetails, EventRow, Region } from "@/lib/types";

export interface EventFormProps {
  e?: Partial<EventRow>;
  priv?: Partial<EventPrivateDetails> | null;
  categories: Category[];
  regions: Region[];
  waiverTemplates: { id: string; title: string; kind: string }[];
  selectedWaivers: string[];
  staff?: { id: string; name: string }[]; // present for admins only
  organizers: { user_id: string; is_lead: boolean }[];
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card space-y-4 p-6">
    <div><h2 className="text-xl text-forest-950">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>
    {children}
  </section>
);

export function EventForm({ e = {}, priv, categories, regions, waiverTemplates, selectedWaivers, staff, organizers }: EventFormProps) {
  const t = (iso?: string | null) => isoToLocalInput(iso ?? null);
  const hidden = new Set(e.hidden_fields ?? []);
  const lines = (a?: string[]) => (a ?? []).join("\n");
  const lead = organizers.find((o) => o.is_lead)?.user_id;
  return (
    <ActionForm action={saveEvent} className="space-y-6" messagePosition="top">
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" required className="sm:col-span-2"><input id="title" name="title" defaultValue={e.title} required className="input" /></Field>
          <Field label="Activity category" htmlFor="category_id" required hint="Changing category doesn't change hidden fields automatically — review them below.">
            <select id="category_id" name="category_id" defaultValue={e.category_id} required className="input">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="Area" htmlFor="region_id">
            <select id="region_id" name="region_id" defaultValue={e.region_id ?? ""} className="input"><option value="">—</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.kind === "area" ? r.name : `${r.name} (${r.kind})`}</option>)}</select>
          </Field>
          <Field label="URL slug" htmlFor="slug" hint="Leave blank to generate from the title."><input id="slug" name="slug" defaultValue={e.slug} className="input" /></Field>
          <Field label="General location (public)" htmlFor="general_location"><input id="general_location" name="general_location" defaultValue={e.general_location ?? ""} className="input" placeholder="e.g. Mount Seymour Provincial Park" /></Field>
          <Field label="Short summary" htmlFor="summary" className="sm:col-span-2"><input id="summary" name="summary" defaultValue={e.summary ?? ""} maxLength={200} className="input" /></Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2" hint="Supports **bold**, lists (- item), ## headings and [links](https://…)."><textarea id="description" name="description" defaultValue={e.description} rows={7} className="input" /></Field>
          <Field label="Cover photo URL" htmlFor="cover_image_url" hint="Upload an image in the panel on the right, then paste its URL here. Leave blank for an illustration."><input id="cover_image_url" name="cover_image_url" defaultValue={e.cover_image_url ?? ""} className="input" /></Field>
          <Field label="Additional photo URLs" htmlFor="gallery_urls" hint="One per line"><textarea id="gallery_urls" name="gallery_urls" defaultValue={lines(e.gallery_urls)} rows={2} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={e.featured} className="accent-forest-700" />Feature on the homepage</label>
        </div>
      </Section>

      <Section title="Date & route">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start (Pacific time)" htmlFor="starts_at" required><input id="starts_at" name="starts_at" type="datetime-local" defaultValue={t(e.starts_at)} required className="input" /></Field>
          <Field label="Estimated finish" htmlFor="ends_at"><input id="ends_at" name="ends_at" type="datetime-local" defaultValue={t(e.ends_at)} className="input" /></Field>
          <Field label="Estimated duration (minutes)" htmlFor="duration_minutes"><input id="duration_minutes" name="duration_minutes" type="number" min={0} defaultValue={e.duration_minutes ?? ""} className="input" /></Field>
          <Field label="Distance (km)" htmlFor="distance_km"><input id="distance_km" name="distance_km" type="number" step="0.1" min={0} defaultValue={e.distance_km ?? ""} className="input" /></Field>
          <Field label="Elevation gain (m)" htmlFor="elevation_gain_m"><input id="elevation_gain_m" name="elevation_gain_m" type="number" min={0} defaultValue={e.elevation_gain_m ?? ""} className="input" /></Field>
          <Field label="Difficulty" htmlFor="difficulty"><select id="difficulty" name="difficulty" defaultValue={e.difficulty ?? ""} className="input"><option value="">—</option>{["easy", "moderate", "challenging", "strenuous", "expert"].map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}</select></Field>
          <Field label="Expected group pace" htmlFor="group_pace" className="sm:col-span-3"><input id="group_pace" name="group_pace" defaultValue={e.group_pace ?? ""} className="input" /></Field>
        </div>
      </Section>

      <Section title="Requirements">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required experience" htmlFor="required_experience"><select id="required_experience" name="required_experience" defaultValue={e.required_experience ?? "none"} className="input">{["none", "beginner", "intermediate", "advanced", "expert"].map((d) => <option key={d} value={d}>{d === "none" ? "None needed" : d[0].toUpperCase() + d.slice(1)}</option>)}</select></Field>
          <Field label="Experience notes" htmlFor="experience_notes"><input id="experience_notes" name="experience_notes" defaultValue={e.experience_notes ?? ""} className="input" /></Field>
          <Field label="Minimum fitness expectations" htmlFor="fitness_expectations" className="sm:col-span-2"><input id="fitness_expectations" name="fitness_expectations" defaultValue={e.fitness_expectations ?? ""} className="input" /></Field>
          <Field label="Required equipment" htmlFor="required_equipment" hint="One item per line"><textarea id="required_equipment" name="required_equipment" defaultValue={lines(e.required_equipment)} rows={5} className="input" /></Field>
          <Field label="Recommended equipment" htmlFor="recommended_equipment" hint="One item per line"><textarea id="recommended_equipment" name="recommended_equipment" defaultValue={lines(e.recommended_equipment)} rows={5} className="input" /></Field>
          <Field label="Food & water" htmlFor="food_water" className="sm:col-span-2"><input id="food_water" name="food_water" defaultValue={e.food_water ?? ""} className="input" /></Field>
        </div>
      </Section>

      <Section title="Logistics & safety" hint="Fields marked 🔒 can be restricted to approved participants.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transportation & carpooling (public)" htmlFor="transportation"><textarea id="transportation" name="transportation" defaultValue={e.transportation ?? ""} rows={2} className="input" /></Field>
          <Field label="Weather considerations" htmlFor="weather_considerations"><textarea id="weather_considerations" name="weather_considerations" defaultValue={e.weather_considerations ?? ""} rows={2} className="input" /></Field>
          <Field label="Safety information" htmlFor="safety_information" className="sm:col-span-2"><textarea id="safety_information" name="safety_information" defaultValue={e.safety_information ?? ""} rows={2} className="input" /></Field>
          <Field label="🔒 Exact meeting location" htmlFor="meeting_location"><input id="meeting_location" name="meeting_location" defaultValue={priv?.meeting_location ?? ""} className="input" /></Field>
          <Field label="🔒 Map link" htmlFor="meeting_location_url"><input id="meeting_location_url" name="meeting_location_url" type="url" defaultValue={priv?.meeting_location_url ?? ""} className="input" /></Field>
          <Field label="🔒 Meeting time note" htmlFor="meeting_time_note"><input id="meeting_time_note" name="meeting_time_note" defaultValue={priv?.meeting_time_note ?? ""} className="input" /></Field>
          <Field label="🔒 Parking information" htmlFor="parking_information"><input id="parking_information" name="parking_information" defaultValue={priv?.parking_information ?? ""} className="input" /></Field>
          <Field label="🔒 Carpool details" htmlFor="carpool_details"><input id="carpool_details" name="carpool_details" defaultValue={priv?.carpool_details ?? ""} className="input" /></Field>
          <Field label="🔒 Additional instructions" htmlFor="additional_instructions"><input id="additional_instructions" name="additional_instructions" defaultValue={priv?.additional_instructions ?? ""} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="restrict_logistics" defaultChecked={e.restrict_logistics ?? true} className="accent-forest-700" />🔒 Restrict exact logistics to approved participants</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="carpool_enabled" defaultChecked={e.carpool_enabled ?? true} className="accent-forest-700" />Enable carpool board</label>
        </div>
      </Section>

      <Section title="Capacity & registration">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Maximum participants" htmlFor="max_participants" required><input id="max_participants" name="max_participants" type="number" min={1} defaultValue={e.max_participants ?? 12} required className="input" /></Field>
          <Field label="Reserved spaces" htmlFor="reserved_spots" hint="Held back for invitations."><input id="reserved_spots" name="reserved_spots" type="number" min={0} defaultValue={e.reserved_spots ?? 0} className="input" /></Field>
          <Field label="Hours to confirm after approval" htmlFor="confirmation_hours"><input id="confirmation_hours" name="confirmation_hours" type="number" min={1} defaultValue={e.confirmation_hours ?? 48} className="input" /></Field>
          <Field label="Registration opens" htmlFor="registration_opens_at" hint="Blank = when published"><input id="registration_opens_at" name="registration_opens_at" type="datetime-local" defaultValue={t(e.registration_opens_at)} className="input" /></Field>
          <Field label="Registration deadline" htmlFor="registration_deadline"><input id="registration_deadline" name="registration_deadline" type="datetime-local" defaultValue={t(e.registration_deadline)} className="input" /></Field>
          <Field label="Free cancellation deadline" htmlFor="cancellation_deadline" hint="Blank = 48h before start"><input id="cancellation_deadline" name="cancellation_deadline" type="datetime-local" defaultValue={t(e.cancellation_deadline)} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="waitlist_enabled" defaultChecked={e.waitlist_enabled ?? true} className="accent-forest-700" />Waitlist enabled</label>
          <Field label="When a place opens" htmlFor="waitlist_mode"><select id="waitlist_mode" name="waitlist_mode" defaultValue={e.waitlist_mode ?? "manual"} className="input"><option value="manual">Notify me; I&apos;ll choose</option><option value="automatic">Offer to next on waitlist automatically</option></select></Field>
          <Field label="Hours to accept an offer" htmlFor="waitlist_offer_hours"><input id="waitlist_offer_hours" name="waitlist_offer_hours" type="number" min={1} defaultValue={e.waitlist_offer_hours ?? 24} className="input" /></Field>
          <Field label="Application questions" htmlFor="application_questions" className="sm:col-span-3"
            hint='One per line. Start with * for required; end with "(yes/no)" for a yes/no answer.'>
            <textarea id="application_questions" name="application_questions" rows={3} className="input"
              defaultValue={(e.application_questions ?? []).map((q) => `${q.required ? "* " : ""}${q.label}${q.type === "yesno" ? " (yes/no)" : ""}`).join("\n")} />
          </Field>
        </div>
      </Section>

      <Section title="Fees & payment" hint="Members are only asked to pay after they're approved.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Participation fee (CAD)" htmlFor="price"><input id="price" name="price" type="number" step="0.01" min={0} defaultValue={((e.price_cents ?? 0) / 100).toString()} className="input" /></Field>
          <Field label="Deposit (CAD, optional)" htmlFor="deposit"><input id="deposit" name="deposit" type="number" step="0.01" min={0} defaultValue={((e.deposit_cents ?? 0) / 100).toString()} className="input" /></Field>
          <Field label="Payment deadline" htmlFor="payment_deadline"><input id="payment_deadline" name="payment_deadline" type="datetime-local" defaultValue={t(e.payment_deadline)} className="input" /></Field>
          <fieldset className="sm:col-span-3"><legend className="label">Allowed payment methods (paid events)</legend>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="payment_methods" value="online" defaultChecked={(e.payment_methods ?? ["online"]).includes("online")} className="accent-forest-700" />Online (Stripe)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="payment_methods" value="cash" defaultChecked={(e.payment_methods ?? []).includes("cash")} className="accent-forest-700" />Cash</label>
            </div>
          </fieldset>
          <Field label="Cancellation policy for this event" htmlFor="cancellation_policy" className="sm:col-span-3"><textarea id="cancellation_policy" name="cancellation_policy" defaultValue={e.cancellation_policy ?? ""} rows={2} className="input" /></Field>
        </div>
      </Section>

      <Section title="Waivers" hint="The general community waiver is always required. Add activity- or event-specific waivers.">
        <div className="grid gap-2 sm:grid-cols-2">
          {waiverTemplates.filter((w) => w.kind !== "general").map((w) => (
            <label key={w.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="waivers" value={w.id} defaultChecked={selectedWaivers.includes(w.id)} className="accent-forest-700" />{w.title}</label>
          ))}
        </div>
      </Section>

      {staff && (
        <Section title="Organizers" hint="Organizers can manage applicants, attendance and communications for this event, and see emergency contacts for confirmed participants.">
          <input type="hidden" name="organizers_present" value="1" />
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-sand-50 px-3 py-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="organizers" value={s.id} defaultChecked={organizers.some((o) => o.user_id === s.id)} className="accent-forest-700" />{s.name}</label>
                <label className="flex items-center gap-1 text-xs text-muted"><input type="radio" name="lead_organizer" value={s.id} defaultChecked={lead === s.id} />Lead</label>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Extras">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="External links" htmlFor="external_links" hint="One per line: Label | https://…"><textarea id="external_links" name="external_links" rows={3} className="input" defaultValue={(e.external_links ?? []).map((l) => `${l.label} | ${l.url}`).join("\n")} /></Field>
          <Field label="Custom bullet sections" htmlFor="custom_sections" hint="## Section title, then - bullet lines"><textarea id="custom_sections" name="custom_sections" rows={3} className="input" defaultValue={(e.custom_sections ?? []).map((s) => `## ${s.title}\n${s.items.map((i) => `- ${i}`).join("\n")}`).join("\n")} /></Field>
          <fieldset className="sm:col-span-2"><legend className="label">Hide fields that don&apos;t apply to this activity</legend>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              {HIDEABLE_FIELDS.map((f) => <label key={f.key} className="flex items-center gap-2"><input type="checkbox" name="hidden_fields" value={f.key} defaultChecked={hidden.has(f.key)} className="accent-forest-700" />{f.label}</label>)}
            </div>
          </fieldset>
        </div>
      </Section>
      <div className="sticky bottom-4 z-10 flex justify-end"><SubmitButton className="btn-primary px-6 py-3 shadow-[var(--shadow-lift)]" pendingText="Saving…">{e.id ? "Save changes" : "Create draft"}</SubmitButton></div>
    </ActionForm>
  );
}
