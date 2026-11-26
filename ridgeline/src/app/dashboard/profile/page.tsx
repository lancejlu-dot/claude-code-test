import Image from "next/image";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { removeAvatar, updateProfile, uploadAvatar } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";
import { getCategories, getRegions } from "@/lib/data/public";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

const DAYS = ["friday", "saturday", "sunday", "weekday-evenings"];

export default async function ProfilePage() {
  const v = await requireViewer("/dashboard/profile");
  const sb = await createClient();
  const [{ data: p }, { data: priv }, categories, regions] = await Promise.all([
    sb.from("profiles").select("*").eq("id", v.id).single(),
    sb.from("member_private").select("*").eq("user_id", v.id).single(),
    getCategories(), getRegions(),
  ]);
  if (!p || !priv) return null;
  const yn = (b: boolean | null) => (b == null ? "" : b ? "yes" : "no");
  return (
    <div className="space-y-8">
      <PageHeader title="Your profile" actions={<Link href={`/members/${v.id}`} className="btn-secondary btn-sm">Preview public profile</Link>}>
        Other members only see your first name, last initial, photo, intro, interests and the experience you choose to share.
      </PageHeader>

      <section className="card flex flex-wrap items-center gap-5 p-6">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-moss-100">
          {p.avatar_url ? <Image src={p.avatar_url} alt="Your profile photo" fill sizes="80px" className="object-cover" />
            : <span className="grid h-full place-items-center font-display text-3xl text-forest-800">{p.first_name[0]}</span>}
        </div>
        <ActionForm action={uploadAvatar} className="flex flex-wrap items-end gap-3">
          <Field label="Profile photo (optional)" htmlFor="avatar" hint="JPG, PNG or WebP, up to 3 MB."><input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" /></Field>
          <SubmitButton className="btn-secondary btn-sm">Upload</SubmitButton>
        </ActionForm>
        {p.avatar_url && <form action={removeAvatar}><button className="btn-ghost btn-sm">Remove photo</button></form>}
      </section>

      <ActionForm action={updateProfile} className="space-y-8">
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="text-xl text-forest-950 sm:col-span-2">About you</h2>
          <Field label="First name" htmlFor="first_name" required><input id="first_name" name="first_name" defaultValue={p.first_name} required className="input" /></Field>
          <Field label="Last name" htmlFor="last_name" required hint="Private — members see your initial only."><input id="last_name" name="last_name" defaultValue={priv.last_name} required className="input" /></Field>
          <Field label="Introduction" htmlFor="intro" required className="sm:col-span-2"><textarea id="intro" name="intro" defaultValue={p.intro} rows={3} minLength={20} maxLength={600} required className="input" /></Field>
          <Field label="General location / city" htmlFor="city"><input id="city" name="city" defaultValue={p.city ?? ""} className="input" /></Field>
          <Field label="Home area" htmlFor="home_region_id">
            <select id="home_region_id" name="home_region_id" defaultValue={p.home_region_id ?? ""} className="input">
              <option value="">Prefer not to say</option>{regions.filter((r) => r.kind === "area").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Outdoor interests</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label key={c.slug} className="chip cursor-pointer bg-sand-100 py-1.5 text-sm has-[:checked]:bg-forest-800 has-[:checked]:text-white">
                  <input type="checkbox" name="interests" value={c.slug} defaultChecked={p.interests.includes(c.slug)} className="sr-only" />{c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Languages spoken" htmlFor="languages" hint="Comma separated"><input id="languages" name="languages" defaultValue={p.languages.join(", ")} className="input" /></Field>
        </section>

        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="text-xl text-forest-950 sm:col-span-2">Experience & preferences</h2>
          <Field label="Hiking experience" htmlFor="hiking_experience">
            <select id="hiking_experience" name="hiking_experience" defaultValue={p.hiking_experience ?? ""} className="input">
              <option value="">—</option>{["beginner", "intermediate", "advanced", "expert"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Preferred difficulty" htmlFor="preferred_difficulty">
            <select id="preferred_difficulty" name="preferred_difficulty" defaultValue={p.preferred_difficulty ?? ""} className="input">
              <option value="">—</option>{["easy", "moderate", "challenging", "strenuous", "expert"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Experience summary" htmlFor="experience_summary" className="sm:col-span-2"><textarea id="experience_summary" name="experience_summary" defaultValue={p.experience_summary ?? ""} rows={2} className="input" placeholder="e.g. Hiked most North Shore peaks; two overnight backpacking trips" /></Field>
          <Field label="Fitness & endurance self-assessment" htmlFor="fitness_self_assessment"><input id="fitness_self_assessment" name="fitness_self_assessment" defaultValue={p.fitness_self_assessment ?? ""} className="input" placeholder="e.g. Comfortable with 15 km / 1,000 m days" /></Field>
          <Field label="Preferred group pace" htmlFor="preferred_pace"><input id="preferred_pace" name="preferred_pace" defaultValue={p.preferred_pace ?? ""} className="input" placeholder="Relaxed / steady / fast" /></Field>
          <Field label="Skills & certifications" htmlFor="skills_certifications" hint="Comma separated, e.g. Standard First Aid, AST 1" className="sm:col-span-2"><input id="skills_certifications" name="skills_certifications" defaultValue={p.skills_certifications.join(", ")} className="input" /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Availability</legend>
            <div className="flex flex-wrap gap-4 text-sm">{DAYS.map((d) => <label key={d} className="flex items-center gap-2"><input type="checkbox" name="weekend_availability" value={d} defaultChecked={p.weekend_availability.includes(d)} className="accent-forest-700" />{d.replace("-", " ").replace(/^./, (c) => c.toUpperCase())}</label>)}</div>
          </fieldset>
          <Field label="Access to a vehicle?" htmlFor="has_vehicle"><select id="has_vehicle" name="has_vehicle" defaultValue={yn(p.has_vehicle)} className="input"><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
          <Field label="Willing to carpool?" htmlFor="willing_to_carpool"><select id="willing_to_carpool" name="willing_to_carpool" defaultValue={yn(p.willing_to_carpool)} className="input"><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="show_experience" defaultChecked={p.show_experience} className="accent-forest-700" />Show my experience and certifications on my member profile</label>
        </section>

        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="text-xl text-forest-950 sm:col-span-2">Private contact & emergency information</h2>
          <p className="text-sm text-muted sm:col-span-2">Never shown to other members. Emergency details are available to organizers of events you&apos;re confirmed for, and every access is logged. Email: <strong>{priv.email}</strong></p>
          <Field label="Phone" htmlFor="phone" required><input id="phone" name="phone" defaultValue={priv.phone} type="tel" required className="input" /></Field>
          <div />
          <Field label="Emergency contact name" htmlFor="emergency_contact_name" required><input id="emergency_contact_name" name="emergency_contact_name" defaultValue={priv.emergency_contact_name} required className="input" /></Field>
          <Field label="Emergency contact phone" htmlFor="emergency_contact_phone" required><input id="emergency_contact_phone" name="emergency_contact_phone" defaultValue={priv.emergency_contact_phone} type="tel" required className="input" /></Field>
          <Field label="Relationship" htmlFor="emergency_contact_relationship"><input id="emergency_contact_relationship" name="emergency_contact_relationship" defaultValue={priv.emergency_contact_relationship ?? ""} className="input" /></Field>
          <Field label="Medical information for emergencies (optional)" htmlFor="medical_notes" hint="e.g. allergies, conditions a first-aider should know." className="sm:col-span-2"><textarea id="medical_notes" name="medical_notes" defaultValue={priv.medical_notes ?? ""} rows={2} className="input" /></Field>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-xl text-forest-950">Communication & consent</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email_notifications" defaultChecked={p.email_notifications} className="accent-forest-700" />Email me updates about my applications and activities (important safety and cancellation notices are always emailed)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="photo_consent" defaultChecked={p.photo_consent} className="accent-forest-700" />I consent to appearing in community photos shared on the website</label>
        </section>
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </ActionForm>
    </div>
  );
}
