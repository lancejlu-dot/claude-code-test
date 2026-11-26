import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/notices";
import { getFaqs } from "@/lib/data/public";

export const metadata: Metadata = { title: "Frequently asked questions", description: "How joining, applications, selection, payments, waivers and safety work." };

export default async function FaqPage() {
  const faqs = await getFaqs();
  const groups = [...new Set(faqs.map((f) => f.category))];
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) };
  return (
    <div className="container-page max-w-4xl py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader eyebrow="Help" title="Frequently asked questions">Everything about joining, applying, getting selected and staying safe.</PageHeader>
      <nav aria-label="FAQ topics" className="mb-10 flex flex-wrap gap-2">
        {groups.map((g) => <a key={g} href={`#${g.toLowerCase()}`} className="chip bg-white px-3 py-1.5 text-sm ring-1 ring-forest-900/10 hover:bg-sand-100">{g}</a>)}
      </nav>
      {groups.map((g) => (
        <section key={g} id={g.toLowerCase()} className="mb-12 scroll-mt-24">
          <h2 className="text-2xl text-forest-950">{g}</h2>
          <div className="mt-4 divide-y divide-forest-900/10 rounded-[var(--radius-card)] bg-white px-5 ring-1 ring-forest-900/5">
            {faqs.filter((f) => f.category === g).map((f) => (
              <details key={f.id} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-forest-950">
                  {f.question}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand-100 transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <Markdown source={f.answer} className="prose-rl mt-2 text-sm" />
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
