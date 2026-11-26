import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/notices";
import { sendAnnouncement } from "@/lib/actions/admin";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Announcements" };

export default async function Announcements() {
  const v = await requireStaff();
  const sb = await createClient();
  const [{ data: events }, { data: groups }, { data: members }, { data: history }] = await Promise.all([
    sb.from("events").select("id,title,starts_at").in("status", ["published", "postponed"]).gte("starts_at", new Date(Date.now() - 7 * 86400_000).toISOString()).order("starts_at"),
    v.isAdmin ? sb.from("member_groups").select("id,name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    v.isAdmin ? sb.from("profiles").select("id,first_name,last_initial").eq("status", "active").order("first_name").limit(500) : Promise.resolve({ data: [] as { id: string; first_name: string; last_initial: string }[] }),
    sb.from("announcements").select("id,audience,title,recipient_count,created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
      <div>
        <PageHeader title="Send an announcement">Delivered in-app immediately and queued for email. Participant announcements also appear on the event&apos;s participant page.</PageHeader>
        <ActionForm action={sendAnnouncement} className="card space-y-4 p-6" resetOnSuccess>
          <Field label="Audience" htmlFor="audience">
            <select id="audience" name="audience" className="input">
              <option value="event_participants">Approved participants of an event</option>
              <option value="event_waitlisted">Waitlisted applicants of an event</option>
              {v.isAdmin && <><option value="all_members">All active members</option><option value="group">A member group</option><option value="individual">An individual member</option></>}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Event" htmlFor="event_id"><select id="event_id" name="event_id" className="input"><option value="">—</option>{(events ?? []).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>
            {v.isAdmin && <Field label="Group" htmlFor="group_id"><select id="group_id" name="group_id" className="input"><option value="">—</option>{(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
            {v.isAdmin && <Field label="Member" htmlFor="user_id"><select id="user_id" name="user_id" className="input"><option value="">—</option>{(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_initial}.</option>)}</select></Field>}
          </div>
          <Field label="Subject" htmlFor="title" required><input id="title" name="title" required maxLength={140} className="input" /></Field>
          <Field label="Message" htmlFor="body" required><textarea id="body" name="body" rows={6} required className="input" /></Field>
          <SubmitButton confirm="Send this announcement now?">Send announcement</SubmitButton>
        </ActionForm>
      </div>
      <aside className="card h-fit p-5">
        <h2 className="text-lg text-forest-950">Recently sent</h2>
        <ul className="mt-3 divide-y divide-forest-900/5 text-sm">{(history ?? []).map((a) => <li key={a.id} className="py-2"><p className="font-medium">{a.title}</p><p className="text-xs text-muted">{a.audience.replace(/_/g, " ")} · {a.recipient_count} recipients · {formatDateTime(a.created_at)}</p></li>)}
          {(history ?? []).length === 0 && <li className="py-2 text-muted">Nothing sent yet.</li>}</ul>
      </aside>
    </div>
  );
}
