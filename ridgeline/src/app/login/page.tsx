import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/notices";
import { signIn } from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  return (
    <AuthShell title="Welcome back" subtitle={<>New here? <Link href="/signup" className="font-semibold text-lake-700 underline">Join the community</Link></>}>
      <div className="max-w-md space-y-4">
        {isDemoMode && <Notice tone="warn" title="Demo mode">Sign-in needs a connected Supabase project. See <Link href="/demo" className="underline">setup instructions</Link>.</Notice>}
        {sp.error === "link-expired" && <Notice tone="warn">That link has expired or was already used. Please try again.</Notice>}
        <ActionForm action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" autoComplete="email" required className="input" /></Field>
          <Field label="Password" htmlFor="password"><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></Field>
          <div className="flex items-center justify-between">
            <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
            <Link href="/forgot-password" className="text-sm font-medium text-lake-700 hover:underline">Forgot password?</Link>
          </div>
        </ActionForm>
      </div>
    </AuthShell>
  );
}
