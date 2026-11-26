import Link from "next/link";
import { PageHeader } from "@/components/notices";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsRead } from "@/lib/actions/member";
import { relativeFromNow } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  await requireViewer("/dashboard/notifications");
  const sb = await createClient();
  const { data } = await sb.from("notifications").select("id,type,title,body,link,created_at,read_at").order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return (
    <div>
      <PageHeader title="Notifications" actions={unread > 0 && <form action={markNotificationsRead}><button className="btn-secondary btn-sm">Mark all as read</button></form>}>
        Updates about your membership, applications and activities. Email copies follow your preferences in <Link href="/dashboard/profile" className="underline">profile</Link>.
      </PageHeader>
      <ul className="card divide-y divide-forest-900/5">
        {(data ?? []).map((n) => (
          <li key={n.id} className={`p-5 ${n.read_at ? "" : "bg-moss-50"}`}>
            <div className="flex items-start justify-between gap-4">
              <p className="font-semibold text-forest-950">{!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ember-500 align-middle" aria-label="Unread" />}{n.title}</p>
              <span className="shrink-0 text-xs text-muted">{relativeFromNow(n.created_at)}</span>
            </div>
            {n.body && <p className="mt-1 text-sm whitespace-pre-line text-forest-900/85">{n.body}</p>}
            {n.link && <Link href={n.link} className="mt-2 inline-block text-sm font-medium text-lake-700 hover:underline">View →</Link>}
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="p-6 text-sm text-muted">You&apos;re all caught up.</li>}
      </ul>
    </div>
  );
}
