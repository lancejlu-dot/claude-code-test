import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Flag } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getCategories } from "@/lib/data/public";
import { createClient } from "@/lib/supabase/server";
import { experienceLabel, membershipDuration } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";

export const metadata = { title: "Member profile", robots: { index: false } };

export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  await requireViewer(`/members/${id}`);
  const sb = await createClient();
  const [{ data }, categories] = await Promise.all([sb.from("public_profiles").select("*").eq("id", id).maybeSingle(), getCategories()]);
  const p = data as PublicProfile | null;
  if (!p) notFound();
  return (
    <div className="container-page max-w-2xl py-12">
      <div className="card p-8">
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-moss-100">
            {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="80px" className="object-cover" /> : <span className="grid h-full place-items-center font-display text-3xl text-forest-800">{p.first_name[0]}</span>}
          </div>
          <div>
            <h1 className="text-3xl text-forest-950">{p.display_name}</h1>
            <p className="text-sm text-muted">{membershipDuration(p.member_since)} · {p.completed_count} community {p.completed_count === 1 ? "activity" : "activities"}</p>
          </div>
        </div>
        <p className="mt-6">{p.intro}</p>
        {p.interests.length > 0 && (
          <div className="mt-6"><p className="text-xs font-semibold tracking-wide text-muted uppercase">Interests</p>
            <div className="mt-2 flex flex-wrap gap-2">{p.interests.map((i) => <span key={i} className="chip bg-moss-100 text-forest-800">{categories.find((c) => c.slug === i)?.name ?? i}</span>)}</div></div>
        )}
        {(p.hiking_experience || p.experience_summary || p.skills_certifications.length > 0) && (
          <div className="mt-6"><p className="text-xs font-semibold tracking-wide text-muted uppercase">Experience</p>
            {p.hiking_experience && <p className="mt-1 text-sm">{experienceLabel[p.hiking_experience]} hiker</p>}
            {p.experience_summary && <p className="mt-1 text-sm">{p.experience_summary}</p>}
            {p.skills_certifications.length > 0 && <p className="mt-1 text-sm text-muted">{p.skills_certifications.join(" · ")}</p>}</div>
        )}
        {p.languages.length > 0 && <p className="mt-4 text-sm text-muted">Speaks {p.languages.join(", ")}</p>}
        {p.badges.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">{p.badges.map((b) => <span key={b.name} className="chip bg-ember-100 text-ember-700" title={b.description ?? undefined}><Award className="h-3.5 w-3.5" aria-hidden />{b.name}</span>)}</div>
        )}
      </div>
      <Link href={`/report?member=${p.id}`} className="btn-ghost btn-sm mt-4"><Flag className="h-3.5 w-3.5" aria-hidden />Report a concern privately</Link>
    </div>
  );
}
