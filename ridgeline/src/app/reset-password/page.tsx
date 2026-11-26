import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { updatePassword } from "@/lib/actions/auth";

export const metadata = { title: "Choose a new password" };

export default function ResetPassword() {
  return (
    <AuthShell title="Choose a new password">
      <ActionForm action={updatePassword} className="max-w-md space-y-4">
        <Field label="New password" htmlFor="password" hint="At least 10 characters."><input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></Field>
        <Field label="Confirm password" htmlFor="confirm"><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input" /></Field>
        <SubmitButton pendingText="Saving…">Update password</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
