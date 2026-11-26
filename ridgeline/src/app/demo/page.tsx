import Link from "next/link";
import { isDemoMode } from "@/lib/env";
import { Notice } from "@/components/notices";

export const metadata = { title: "About this demo" };

export default function DemoPage() {
  return (
    <div className="container-page max-w-3xl py-16">
      <p className="eyebrow">Setup</p>
      <h1 className="mt-2 text-4xl text-forest-950">About this demo</h1>
      <div className="prose-rl mt-6">
        {isDemoMode ? (
          <Notice tone="warn" title="You are viewing demo mode">
            No database is connected. The public pages show fictional sample activities and people so you can preview the design.
            Sign-in, applications, payments, waivers and emails are disabled — nothing here is real.
          </Notice>
        ) : (
          <Notice title="A database is connected">This site is running against a live Supabase project.</Notice>
        )}
        <h2>Connect the real platform</h2>
        <ol>
          <li>Create a Supabase project and run the SQL migrations in <code>supabase/migrations</code> (or <code>supabase db push</code>).</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Supabase URL and keys.</li>
          <li>Optionally load fictional demo members and events with <code>supabase/seed.sql</code> (staging only — never production).</li>
          <li>Sign up, then make yourself owner once in the SQL editor: <code>select public.bootstrap_owner(&apos;you@example.com&apos;);</code></li>
          <li>Add Stripe and Resend keys to enable online payments and email delivery.</li>
        </ol>
        <p>Full instructions are in the project README.</p>
      </div>
      <Link href="/" className="btn-secondary mt-8">Back to home</Link>
    </div>
  );
}
