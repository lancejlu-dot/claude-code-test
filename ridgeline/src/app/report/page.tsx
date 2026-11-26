import { ShieldAlert } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/notices";
import { submitReport } from "@/lib/actions/member";
import { requireViewer } from "@/lib/auth";

export const metadata = { title: "Report a concern" };

export default async function Report({ searchParams }: PageProps<"/report">) {
  await requireViewer("/report");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return (
    <div className="container-page max-w-2xl py-12">
      <PageHeader eyebrow="Private" title="Report a concern">
        Reports go only to moderators and administrators. We never tell the person being reported who made a report.
      </PageHeader>
      <Notice tone="warn" title="In immediate danger?">Call 911. For search and rescue in BC, call 911 and ask for the RCMP.</Notice>
      <ActionForm action={submitReport} className="card mt-6 space-y-4 p-6" resetOnSuccess>
        <input type="hidden" name="event_id" value={one("event")} />
        <input type="hidden" name="post_id" value={one("post")} />
        <input type="hidden" name="subject_user_id" value={one("member")} />
        <Field label="What kind of concern?" htmlFor="category" required>
          <select id="category" name="category" required className="input">
            <option value="harassment">Harassment or unwanted behaviour</option><option value="safety">Safety concern</option>
            <option value="misconduct">Code of conduct issue</option><option value="content">Inappropriate post or content</option><option value="other">Something else</option>
          </select>
        </Field>
        <Field label="What happened?" htmlFor="details" required hint="Include when and where, and anyone involved. Share only what you're comfortable with.">
          <textarea id="details" name="details" rows={6} required minLength={10} maxLength={4000} className="input" />
        </Field>
        <SubmitButton><ShieldAlert className="h-4 w-4" aria-hidden />Send privately</SubmitButton>
      </ActionForm>
    </div>
  );
}
