import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { LegalReviewNotice, PageHeader } from "@/components/notices";
import { createWaiverTemplate } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { getCategories } from "@/lib/data/public";

export const metadata = { title: "New waiver" };

export default async function NewWaiver() {
  await requireAdmin();
  const categories = await getCategories();
  return (
    <div className="max-w-3xl">
      <PageHeader title="New waiver template" />
      <LegalReviewNotice what="Any waiver you write here" />
      <ActionForm action={createWaiverTemplate} className="card mt-6 space-y-4 p-6">
        <Field label="Title" htmlFor="title" required><input id="title" name="title" required className="input" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="kind"><select id="kind" name="kind" className="input"><option value="activity">Activity-specific</option><option value="event">Event-specific risk acknowledgement</option><option value="general">General community</option></select></Field>
          <Field label="Activity category" htmlFor="category_id"><select id="category_id" name="category_id" className="input"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <Field label="Description" htmlFor="description"><input id="description" name="description" className="input" /></Field>
        <Field label="Waiver text" htmlFor="body" required hint="Markdown supported."><textarea id="body" name="body" rows={14} required className="input font-mono text-sm" /></Field>
        <SubmitButton>Create template (version 1)</SubmitButton>
      </ActionForm>
    </div>
  );
}
