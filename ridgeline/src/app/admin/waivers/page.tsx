import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/notices";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Waivers" };

export default async function Waivers() {
  await requireAdmin();
  const sb = await createClient();
  const { data } = await sb.from("waiver_templates").select("id,title,kind,current_version,legal_reviewed,active,updated_at,activity_categories(name),waiver_signatures(count)").order("kind");
  return (
    <div>
      <PageHeader title="Waiver templates" actions={<Link href="/admin/waivers/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" aria-hidden />New template</Link>}>
        Reusable waivers with version tracking. Members must sign every required waiver before their place is confirmed.
      </PageHeader>
      <div className="card divide-y divide-forest-900/5">
        {(data ?? []).map((t) => (
          <Link key={t.id} href={`/admin/waivers/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-sand-50">
            <div><p className="font-semibold text-forest-950">{t.title}</p>
              <p className="text-sm text-muted capitalize">{t.kind}{(t.activity_categories as unknown as { name: string } | null)?.name ? ` · ${(t.activity_categories as unknown as { name: string }).name}` : ""} · v{t.current_version} · updated {formatDate(t.updated_at)} · {(t.waiver_signatures as unknown as { count: number }[])[0]?.count ?? 0} signatures</p></div>
            {t.legal_reviewed ? <span className="chip bg-moss-100 text-forest-800">Legally reviewed</span> : <span className="chip bg-ember-100 text-ember-700">Needs legal review</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
