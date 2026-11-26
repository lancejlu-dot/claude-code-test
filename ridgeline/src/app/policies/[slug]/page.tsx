import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { LegalReviewNotice } from "@/components/notices";
import { getPolicies, getPolicy } from "@/lib/data/public";
import { formatDateLong } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const p = await getPolicy((await params).slug);
  return p ? { title: p.title, description: p.summary ?? undefined } : { title: "Policy not found" };
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const [p, all] = await Promise.all([getPolicy(slug), getPolicies()]);
  if (!p) notFound();
  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Policies" className="lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow mb-3">Policies</p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {all.map((x) => (
            <li key={x.slug}><Link href={`/policies/${x.slug}`} aria-current={x.slug === slug ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap ${x.slug === slug ? "bg-forest-800 text-white" : "text-forest-900 hover:bg-forest-900/5"}`}>{x.title}</Link></li>
          ))}
        </ul>
      </nav>
      <article className="max-w-3xl">
        <h1 className="text-4xl text-forest-950">{p.title}</h1>
        {p.summary && <p className="mt-2 text-lg text-muted">{p.summary}</p>}
        <p className="mt-2 text-xs text-muted">Last updated {formatDateLong(p.updated_at)}</p>
        {!p.legal_reviewed && <div className="mt-6"><LegalReviewNotice what="This policy" /></div>}
        <div className="mt-8"><Markdown source={p.body} /></div>
      </article>
    </div>
  );
}
