import Link from "next/link";
import { Download } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { deleteMyAccount } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";

export const metadata = { title: "Privacy & account" };

export default async function Account() {
  await requireViewer("/dashboard/account");
  return (
    <div className="space-y-8">
      <PageHeader title="Privacy & account">Control your personal information. See our <Link href="/policies/privacy-policy" className="underline">privacy policy</Link>.</PageHeader>
      <section className="card p-6">
        <h2 className="text-xl text-forest-950">Download your data</h2>
        <p className="mt-1 text-sm text-muted">A JSON file with your profile, contact details, applications, waiver signatures, payments, posts, suggestions and notifications.</p>
        <a href="/api/me/export" className="btn-secondary mt-4"><Download className="h-4 w-4" aria-hidden />Download my data</a>
      </section>
      <section className="card p-6">
        <h2 className="text-xl text-forest-950">Change password</h2>
        <p className="mt-1 text-sm text-muted">We&apos;ll email you a secure link.</p>
        <Link href="/forgot-password" className="btn-secondary mt-4">Send password reset link</Link>
      </section>
      <section className="card p-6 ring-ember-600/30">
        <h2 className="text-xl text-ember-700">Delete account</h2>
        <div className="mt-2 space-y-2 text-sm text-forest-900">
          <p>Deleting your account will cancel any upcoming applications, remove your profile, contact details, emergency contact, carpool offers and notifications, and anonymise your discussion posts.</p>
          <p><strong>What we keep:</strong> signed waiver records and payment records are retained for legal and accounting purposes, detached from your contact information, for the period set in our retention policy.</p>
        </div>
        <ActionForm action={deleteMyAccount} className="mt-4 max-w-sm space-y-3">
          <Field label='Type "DELETE" to confirm' htmlFor="confirm"><input id="confirm" name="confirm" required className="input" autoComplete="off" /></Field>
          <SubmitButton className="btn-danger" confirm="This cannot be undone. Delete your account?">Permanently delete my account</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
