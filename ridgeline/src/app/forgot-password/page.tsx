import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { requestPasswordReset } from "@/lib/actions/auth";

export const metadata = { title: "Reset password" };

export default function ForgotPassword() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure link to choose a new password.">
      <ActionForm action={requestPasswordReset} className="max-w-md space-y-4" resetOnSuccess>
        <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" required autoComplete="email" className="input" /></Field>
        <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
