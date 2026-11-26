import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ClipboardCheck, HeartHandshake, ShieldCheck, Lock, UserCheck, FileSignature, Mountain } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { NamedIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { getCategories, getCommunityStats, getFaqs, getHighlights, getHomepage, listEvents } from "@/lib/data/public";
import { getViewer } from "@/lib/auth";

const VALUE_ICONS = [UserCheck, ShieldCheck, HeartHandshake, Lock];
const STEPS = [
  { icon: UserCheck, title: "Join", body: "Create a profile with an emergency contact and a short intro. An admin welcomes every new member." },
  { icon: ClipboardCheck, title: "Apply", body: "Pick an activity that fits your experience and answer a couple of trip-specific questions." },
  { icon: FileSignature, title: "Get selected & confirm", body: "Organizers select balanced, prepared groups. Sign the waiver, pay if needed, confirm your spot." },
  { icon: Mountain, title: "Show up", body: "Meet your group at the trailhead. Reliable members get priority — that's what keeps it great." },
];

export const revalidate = 600;

export default async function HomePage() {
  const [home, upcoming, featured, categories, stats, highlights, faqs, viewer] = await Promise.all([
    getHomepage(), listEvents({}, { limit: 6 }), listEvents({}, { featuredOnly: true, limit: 3 }), getCategories(),
    getCommunityStats(), getHighlights(), getFaqs(), getViewer(),
  ]);
  const showcase = featured.length ? featured : upcoming.slice(0, 3);
  const more = upcoming.filter((e) => !showcase.some((s) => s.id === e.id) && e.public_status !== "cancelled").slice(0, 3);
  const homeFaqs = faqs.filter((f) => f.show_on_home).slice(0, 5);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image src={home.hero_image_url} alt="" fill priority sizes="100vw" unoptimized={home.hero_image_url.endsWith(".svg")} className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/35 to-forest-950/10" />
        </div>
        <div className="container-page flex min-h-[78svh] flex-col justify-end pt-28 pb-14 sm:pb-20">
          <p className="eyebrow !text-ember-100">Lower Mainland · British Columbia</p>
          <h1 className="mt-3 max-w-3xl text-[2.6rem] leading-[1.05] font-semibold text-white sm:text-6xl lg:text-7xl">{home.hero_title}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">{home.hero_subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/activities" className="btn-accent px-6 py-3 text-base">Explore activities <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            {!viewer && <Link href="/signup" className="btn bg-white/95 px-6 py-3 text-base text-forest-950 hover:bg-white">Join the community</Link>}
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/20 pt-6 text-white">
            <div><dt className="text-xs text-white/70">Active members</dt><dd className="font-display text-2xl sm:text-3xl">{stats.members}</dd></div>
            <div><dt className="text-xs text-white/70">Trips completed</dt><dd className="font-display text-2xl sm:text-3xl">{stats.events_completed}</dd></div>
            <div><dt className="text-xs text-white/70">Attendance rate</dt><dd className="font-display text-2xl sm:text-3xl">{stats.attendance_rate != null ? `${stats.attendance_rate}%` : "—"}</dd></div>
          </dl>
        </div>
      </section>

      {/* Values */}
      <section className="container-page py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Why we&apos;re different</p>
            <h2 className="mt-2 text-3xl text-forest-950 sm:text-4xl">A community, not a ticket queue.</h2>
            <p className="mt-4 text-muted">
              Every activity is curated and every group is selected — so you&apos;re hiking with people who are prepared,
              reliable and genuinely glad to be there.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {home.values.map((v, i) => {
              const Icon = VALUE_ICONS[i % VALUE_ICONS.length];
              return (
                <div key={v.title} className="card p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-moss-100 text-forest-700"><Icon className="h-5 w-5" aria-hidden /></span>
                  <h3 className="mt-4 text-lg text-forest-950">{v.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{v.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured & upcoming */}
      <section className="bg-white py-20">
        <div className="container-page">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Coming up</p>
              <h2 className="mt-2 text-3xl text-forest-950 sm:text-4xl">Featured activities</h2>
            </div>
            <Link href="/activities" className="btn-secondary self-start">See all activities <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((e, i) => <EventCard key={e.id} e={e} priority={i === 0} />)}
          </div>
          {more.length > 0 && (
            <>
              <h3 className="mt-14 text-xl text-forest-950">Also on the calendar</h3>
              <ul className="mt-4 divide-y divide-forest-900/5 rounded-2xl ring-1 ring-forest-900/5">
                {more.map((e) => (
                  <li key={e.id}>
                    <Link href={`/activities/${e.slug}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-sand-50">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-moss-100 text-forest-700"><NamedIcon name={e.category_icon} className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-forest-950">{e.title}</span>
                        <span className="block text-sm text-muted">
                          {new Intl.DateTimeFormat("en-CA", { timeZone: e.time_zone, weekday: "short", month: "short", day: "numeric" }).format(new Date(e.starts_at))} · {e.region_name}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-20">
        <p className="eyebrow">Something for every season</p>
        <h2 className="mt-2 text-3xl text-forest-950 sm:text-4xl">Activity categories</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.slug} href={`/activities?category=${c.slug}`}
              className="group card flex flex-col items-start gap-3 p-4 transition hover:bg-forest-800 hover:text-white">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-moss-100 text-forest-700 group-hover:bg-white/15 group-hover:text-white">
                <NamedIcon name={c.icon} className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-forest-900 py-16 text-white">
        <div className="container-page grid grid-cols-2 gap-8 lg:grid-cols-4">
          {[
            { label: "Active members", value: stats.members },
            { label: "Activities completed", value: stats.events_completed },
            { label: "Spots filled by members", value: stats.participations },
            { label: "Kilometres travelled together", value: stats.km_travelled.toLocaleString("en-CA") },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl sm:text-5xl">{s.value}</p>
              <p className="mt-1 text-sm text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 max-w-2xl text-3xl text-forest-950 sm:text-4xl">Applying doesn&apos;t guarantee a spot — and that&apos;s the point.</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-ember-500 text-white"><s.icon className="h-5 w-5" aria-hidden /></span>
                <span className="font-display text-sm text-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg text-forest-950">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="bg-white py-20">
          <div className="container-page">
            <p className="eyebrow">From the trail</p>
            <h2 className="mt-2 text-3xl text-forest-950 sm:text-4xl">Recent highlights</h2>
            <p className="mt-2 text-sm text-muted">Shared only with the consent of everyone pictured.</p>
            <div className="mt-10 grid auto-rows-[220px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.map((h, i) => (
                <figure key={h.id} className={`relative overflow-hidden rounded-[var(--radius-card)] ${i === 0 ? "sm:col-span-2 sm:row-span-2" : i === 3 ? "lg:col-span-2" : ""}`}>
                  <Image src={h.image_url} alt={h.title} fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized={h.image_url.endsWith(".svg")} className="object-cover" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                    <p className="font-display text-lg">{h.title}</p>
                    {h.caption && <p className="text-sm text-white/80">{h.caption}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="container-page grid gap-10 py-20 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="eyebrow">Questions</p>
          <h2 className="mt-2 text-3xl text-forest-950 sm:text-4xl">Good to know</h2>
          <Link href="/faq" className="btn-secondary mt-6">Read the full FAQ</Link>
        </div>
        <div className="divide-y divide-forest-900/10 border-y border-forest-900/10">
          {homeFaqs.map((f) => (
            <details key={f.id} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-forest-950">
                {f.question}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand-100 text-forest-800 transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <Markdown source={f.answer} className="prose-rl mt-2 text-sm" />
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-page">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-forest-800 px-6 py-14 text-center text-white sm:px-16">
          <Image src="/images/scenes/alpine-lake.svg" alt="" fill unoptimized className="-z-10 object-cover opacity-30" />
          <h2 className="mx-auto max-w-2xl text-3xl sm:text-4xl">Your next weekend starts at the trailhead.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Join a community of prepared, reliable people who love the mountains, the water and each other&apos;s company.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={viewer ? "/activities" : "/signup"} className="btn-accent px-6 py-3 text-base">{viewer ? "Find your next trip" : "Apply to join"}</Link>
            <Link href="/policies/community-guidelines" className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/20">Read our guidelines</Link>
          </div>
        </div>
      </section>
    </>
  );
}
