import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CalendarDays, Car, Clock, CloudSun, ExternalLink, Gauge, Lock, MapPin, Route, ShieldAlert, TrendingUp, Users, Utensils,
} from "lucide-react";
import { DifficultyBadge, EventStatusBadge } from "@/components/badges";
import { EventImage } from "@/components/event-image";
import { NamedIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Notice } from "@/components/notices";
import { ApplyPanel } from "./apply-panel";
import { getEventBySlug, getOrganizers, getPrivateDetails } from "@/lib/data/public";
import { getViewer } from "@/lib/auth";
import { getMyApplication } from "@/lib/data/member";
import { isVisible } from "@/lib/event-fields";
import { experienceLabel, formatDateLong, formatDuration, formatMoney, formatTime, membershipDuration } from "@/lib/format";
import { siteUrl } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/activities/[slug]">): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  if (!e) return { title: "Activity not found" };
  return {
    title: e.title,
    description: e.summary ?? undefined,
    openGraph: { title: e.title, description: e.summary ?? undefined, images: e.cover_image_url ? [e.cover_image_url] : undefined },
    alternates: { canonical: `/activities/${e.slug}` },
  };
}

export default async function EventPage({ params }: PageProps<"/activities/[slug]">) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) notFound();
  const [viewer, organizers, logistics] = await Promise.all([getViewer(), getOrganizers(e.id), getPrivateDetails(e)]);
  const myApp = viewer ? await getMyApplication(e.id, viewer.id) : null;
  const show = (k: string) => isVisible(e.hidden_fields, k);

  const facts = [
    { icon: CalendarDays, label: "Date", value: formatDateLong(e.starts_at, e.time_zone) },
    { icon: Clock, label: "Time", value: `${formatTime(e.starts_at, e.time_zone)}${e.ends_at ? ` – approx. ${formatTime(e.ends_at, e.time_zone)}` : ""}` },
    { icon: MapPin, label: "Area", value: [e.general_location, e.region_name].filter(Boolean).join(" · ") },
    show("distance_km") && e.distance_km != null && { icon: Route, label: "Distance", value: `${e.distance_km} km` },
    show("elevation_gain_m") && e.elevation_gain_m != null && { icon: TrendingUp, label: "Elevation gain", value: `${e.elevation_gain_m} m` },
    show("duration_minutes") && e.duration_minutes != null && { icon: Clock, label: "Estimated duration", value: formatDuration(e.duration_minutes) },
    show("group_pace") && e.group_pace && { icon: Gauge, label: "Group pace", value: e.group_pace },
    { icon: Users, label: "Group size", value: `Up to ${e.max_participants} participants` },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[];

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.summary ?? e.description.slice(0, 200),
    startDate: e.starts_at, endDate: e.ends_at ?? undefined,
    eventStatus: e.public_status === "cancelled" ? "https://schema.org/EventCancelled" : e.public_status === "postponed" ? "https://schema.org/EventPostponed" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: e.general_location ?? e.region_name, address: { "@type": "PostalAddress", addressRegion: "BC", addressCountry: "CA" } },
    image: e.cover_image_url ? [`${siteUrl}${e.cover_image_url.startsWith("/") ? e.cover_image_url : ""}`] : undefined,
    offers: { "@type": "Offer", price: (e.price_cents / 100).toFixed(2), priceCurrency: e.currency, url: `${siteUrl}/activities/${e.slug}` },
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="relative h-[42svh] min-h-72 overflow-hidden bg-sand-200 sm:h-[52svh]">
        <EventImage src={e.cover_image_url} category={e.category_slug} alt="" priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-950/20 to-transparent" />
        <div className="container-page absolute inset-x-0 bottom-0 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-white/90 text-forest-900"><NamedIcon name={e.category_icon} className="h-3.5 w-3.5" />{e.category_name}</span>
            <EventStatusBadge status={e.public_status} />
            {show("difficulty") && <DifficultyBadge difficulty={e.difficulty} />}
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl leading-tight text-white sm:text-5xl">{e.title}</h1>
          {e.summary && <p className="mt-2 max-w-2xl text-white/85 sm:text-lg">{e.summary}</p>}
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          {e.status_note && (e.public_status === "postponed" || e.public_status === "cancelled") && (
            <Notice tone="warn" title={e.public_status === "cancelled" ? (e.weather_cancellation ? "Cancelled due to weather" : "Cancelled") : "Postponed"}>{e.status_note}</Notice>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-forest-900/5 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted"><f.icon className="h-3.5 w-3.5" aria-hidden />{f.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-forest-950">{f.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="about"><h2 id="about" className="text-2xl text-forest-950">About this activity</h2><Markdown source={e.description} /></section>

          {(show("required_experience") || show("fitness_expectations")) && (
            <section aria-labelledby="req" className="grid gap-4 sm:grid-cols-2">
              <h2 id="req" className="text-2xl text-forest-950 sm:col-span-2">Who it&apos;s for</h2>
              {show("required_experience") && (
                <div className="card p-5"><p className="text-xs font-semibold tracking-wide text-muted uppercase">Required experience</p>
                  <p className="mt-1 font-semibold text-forest-950">{experienceLabel[e.required_experience]}</p>
                  {e.experience_notes && <p className="mt-1 text-sm text-muted">{e.experience_notes}</p>}</div>
              )}
              {show("fitness_expectations") && e.fitness_expectations && (
                <div className="card p-5"><p className="text-xs font-semibold tracking-wide text-muted uppercase">Minimum fitness</p><p className="mt-1 text-sm text-forest-950">{e.fitness_expectations}</p></div>
              )}
            </section>
          )}

          {(e.required_equipment.length > 0 && show("required_equipment")) || (e.recommended_equipment.length > 0 && show("recommended_equipment")) ? (
            <section aria-labelledby="gear" className="grid gap-6 sm:grid-cols-2">
              <h2 id="gear" className="text-2xl text-forest-950 sm:col-span-2">What to bring</h2>
              {show("required_equipment") && e.required_equipment.length > 0 && <List title="Required" items={e.required_equipment} strong />}
              {show("recommended_equipment") && e.recommended_equipment.length > 0 && <List title="Recommended" items={e.recommended_equipment} />}
            </section>
          ) : null}

          <section aria-labelledby="logistics" className="space-y-4">
            <h2 id="logistics" className="text-2xl text-forest-950">Logistics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {show("food_water") && e.food_water && <Info icon={Utensils} title="Food & water">{e.food_water}</Info>}
              {show("transportation") && e.transportation && <Info icon={Car} title="Transportation & carpooling">{e.transportation}{e.carpool_enabled && " Confirmed participants can coordinate carpools on the participant page."}</Info>}
              {show("weather_considerations") && e.weather_considerations && <Info icon={CloudSun} title="Weather">{e.weather_considerations}</Info>}
              {show("safety_information") && e.safety_information && <Info icon={ShieldAlert} title="Safety">{e.safety_information}</Info>}
            </div>
            {logistics ? (
              <div className="card space-y-3 p-5">
                <p className="flex items-center gap-2 font-semibold text-forest-950"><MapPin className="h-4 w-4 text-ember-600" aria-hidden />Meeting point</p>
                <p className="text-sm">{logistics.meeting_location}{logistics.meeting_location_url && <> · <a href={logistics.meeting_location_url} target="_blank" rel="noopener noreferrer" className="text-lake-700 underline">Map</a></>}</p>
                {logistics.meeting_time_note && <p className="text-sm text-muted">{logistics.meeting_time_note}</p>}
                {show("parking_information") && logistics.parking_information && <p className="text-sm"><strong>Parking:</strong> {logistics.parking_information}</p>}
                {logistics.carpool_details && <p className="text-sm"><strong>Carpools:</strong> {logistics.carpool_details}</p>}
                {logistics.additional_instructions && <p className="text-sm"><strong>Additional instructions:</strong> {logistics.additional_instructions}</p>}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-sand-100 p-4 text-sm text-forest-900">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>The exact meeting point, parking and other logistics are shared with selected participants once they&apos;re approved.</p>
              </div>
            )}
          </section>

          {e.custom_sections.map((s) => <List key={s.title} title={s.title} items={s.items} heading />)}

          {e.external_links.length > 0 && (
            <section aria-labelledby="links">
              <h2 id="links" className="text-2xl text-forest-950">Useful links</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {e.external_links.map((l) => (
                  <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">{l.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a></li>
                ))}
              </ul>
            </section>
          )}

          {organizers.length > 0 && (
            <section aria-labelledby="org">
              <h2 id="org" className="text-2xl text-forest-950">Your organizers</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {organizers.map((o) => {
                  const name = "display_name" in o ? o.display_name : "";
                  const id = "user_id" in o ? o.user_id : (o as { id: string }).id;
                  return (
                    <div key={id} className="card flex gap-4 p-5">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest-800 font-display text-lg text-white">{name[0]}</span>
                      <div>
                        <p className="font-semibold text-forest-950">{name} {o.is_lead && <span className="chip ml-1 bg-moss-100 text-forest-800">Lead</span>}</p>
                        <p className="mt-1 text-sm text-muted">{o.intro}</p>
                        <p className="mt-1 text-xs text-muted">{o.completed_count} community activities{"member_since" in o ? ` · ${membershipDuration(o.member_since as string)}` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside id="apply" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-5 p-6">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl text-forest-950">{formatMoney(e.price_cents, e.currency)}</span>
              {e.deposit_cents > 0 && <span className="text-sm text-muted">{formatMoney(e.deposit_cents)} deposit</span>}
            </div>
            <ApplyPanel e={e} viewer={viewer ? { status: viewer.status } : null} app={myApp} />
            <dl className="space-y-2 border-t border-forest-900/5 pt-4 text-sm">
              <Row k="Spots">{e.spots_taken} of {e.max_participants} filled{e.reserved_spots ? ` · ${e.reserved_spots} reserved` : ""}</Row>
              {e.waitlist_count > 0 && <Row k="Waitlist">{e.waitlist_count}</Row>}
              {e.registration_deadline && <Row k="Apply by">{formatDateLong(e.registration_deadline, e.time_zone).replace(/, \d{4}$/, "")}, {formatTime(e.registration_deadline, e.time_zone)}</Row>}
              {e.cancellation_deadline && <Row k="Free cancellation until">{formatDateLong(e.cancellation_deadline, e.time_zone).replace(/, \d{4}$/, "")}</Row>}
              {e.price_cents > 0 && <Row k="Payment">{e.payment_methods.filter((m) => m !== "none").map((m) => (m === "online" ? "Card online" : "Cash")).join(" or ")} · after approval</Row>}
            </dl>
            {show("cancellation_policy") && e.cancellation_policy && <p className="rounded-xl bg-sand-100 p-3 text-xs text-forest-900">{e.cancellation_policy}</p>}
            <p className="text-xs text-muted">Applying doesn&apos;t guarantee a place. <Link href="/faq" className="underline">How selection works</Link></p>
          </div>
        </aside>
      </div>
      {/* Mobile: keep price and the call to action within reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-forest-900/10 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0"><p className="font-display text-xl leading-none text-forest-950">{formatMoney(e.price_cents, e.currency)}</p>
          <p className="truncate text-xs text-muted">{formatDateLong(e.starts_at, e.time_zone).replace(/, \d{4}$/, "")}</p></div>
        <a href="#apply" className="btn-accent shrink-0">{e.public_status === "open" ? "Apply" : e.public_status === "waitlist" ? "Join waitlist" : "Details"}</a>
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
    </article>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium text-forest-950">{children}</dd></div>;
}
function Info({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return <div className="card p-5"><p className="flex items-center gap-2 font-semibold text-forest-950"><Icon className="h-4 w-4 text-moss-400" aria-hidden />{title}</p><p className="mt-2 text-sm text-forest-900/85">{children}</p></div>;
}
function List({ title, items, strong, heading }: { title: string; items: string[]; strong?: boolean; heading?: boolean }) {
  const H = heading ? "h2" : "h3";
  return (
    <div className={heading ? "" : "card p-5"}>
      <H className={heading ? "text-2xl text-forest-950" : "font-semibold text-forest-950"}>{title}</H>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => <li key={it} className="flex gap-2.5"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${strong ? "bg-ember-500" : "bg-moss-400"}`} aria-hidden />{it}</li>)}
      </ul>
    </div>
  );
}
