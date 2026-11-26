import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/notices";
import { signUp } from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Join the community" };

export default function SignupPage() {
  return (
    <AuthShell title="Join the community" image="/images/scenes/forest-falls.svg"
      subtitle={<>Already a member? <Link href="/login" className="font-semibold text-lake-700 underline">Sign in</Link>. New members are reviewed by an administrator, usually within two days.</>}>
      {isDemoMode && <div className="mb-6 max-w-2xl"><Notice tone="warn" title="Demo mode">Sign-up is disabled until a Supabase project is connected.</Notice></div>}
      <ActionForm action={signUp} className="max-w-2xl space-y-8" messagePosition="top">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-display text-lg text-forest-950">About you</legend>
          <Field label="First name" htmlFor="first_name" required><input id="first_name" name="first_name" autoComplete="given-name" required className="input" /></Field>
          <Field label="Last name" htmlFor="last_name" required hint="Other members only see your last initial."><input id="last_name" name="last_name" autoComplete="family-name" required className="input" /></Field>
          <Field label="Email" htmlFor="email" required><input id="email" name="email" type="email" autoComplete="email" required className="input" /></Field>
          <Field label="Phone number" htmlFor="phone" required hint="Never shown to other members."><input id="phone" name="phone" type="tel" autoComplete="tel" required className="input" /></Field>
          <Field label="Password" htmlFor="password" required hint="At least 10 characters." className="sm:col-span-2"><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" /></Field>
          <Field label="Short introduction" htmlFor="intro" required className="sm:col-span-2" hint="What do you love doing outside? What's your experience? (Shown on your member profile.)">
            <textarea id="intro" name="intro" rows={3} minLength={20} maxLength={600} required className="input" />
          </Field>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-1 font-display text-lg text-forest-950">Emergency contact</legend>
          <p className="text-sm text-muted sm:col-span-3">Only shared with administrators and the organizers of events you are confirmed for. Every access is logged.</p>
          <Field label="Name" htmlFor="emergency_contact_name" required><input id="emergency_contact_name" name="emergency_contact_name" required className="input" /></Field>
          <Field label="Phone" htmlFor="emergency_contact_phone" required><input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" required className="input" /></Field>
          <Field label="Relationship" htmlFor="emergency_contact_relationship"><input id="emergency_contact_relationship" name="emergency_contact_relationship" className="input" placeholder="e.g. Partner" /></Field>
        </fieldset>
        <fieldset className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-forest-900/10">
          <legend className="sr-only">Confirmations</legend>
          {[
            { name: "age_confirmed", label: <>I confirm I am at least 18 years old.</> },
            { name: "guidelines_accepted", label: <>I have read and agree to the <Link href="/policies/community-guidelines" target="_blank" className="underline">community guidelines</Link> and <Link href="/policies/code-of-conduct" target="_blank" className="underline">code of conduct</Link>.</> },
            { name: "terms_accepted", label: <>I accept the <Link href="/policies/privacy-policy" target="_blank" className="underline">privacy policy</Link> and <Link href="/policies/terms-of-use" target="_blank" className="underline">terms of use</Link>.</> },
          ].map((c) => (
            <label key={c.name} className="flex items-start gap-3 text-sm">
              <input type="checkbox" name={c.name} required className="mt-0.5 h-4 w-4 rounded accent-forest-700" />
              <span>{c.label} <span className="text-ember-600" aria-hidden>*</span></span>
            </label>
          ))}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="photo_consent" className="mt-0.5 h-4 w-4 rounded accent-forest-700" />
            <span>Optional: I&apos;m happy to appear in community photos shared on the website (<Link href="/policies/photo-media-consent" target="_blank" className="underline">photo policy</Link>). You can change this any time.</span>
          </label>
        </fieldset>
        <SubmitButton className="btn-accent px-6 py-3" pendingText="Creating your account…">Create account</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
