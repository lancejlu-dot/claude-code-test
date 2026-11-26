import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, LayoutGrid } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { EventCalendar } from "@/components/event-calendar";
import { EventFiltersForm } from "@/components/event-filters";
import { EmptyState, PageHeader } from "@/components/notices";
import { getCategories, getRegions, listEvents, listEventsForMonth } from "@/lib/data/public";
import { filtersToSearch, parseFilters } from "@/lib/filters";
import { cn, localDay } from "@/lib/format";

export const metadata: Metadata = {
  title: "Activities",
  description: "Browse upcoming hikes, paddles, snowshoe trips, rides and weekend adventures across the Lower Mainland.",
};

export default async function ActivitiesPage({ searchParams }: PageProps<"/activities">) {
  const f = parseFilters(await searchParams);
  const [categories, regions] = await Promise.all([getCategories(), getRegions()]);
  const month = f.month ?? localDay(new Date()).slice(0, 7);
  const events = f.view === "calendar" ? await listEventsForMonth(month, f) : await listEvents(f);
  const category = categories.find((c) => c.slug === f.category);

  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader eyebrow="Discover" title={category ? category.name : f.past ? "Past activities" : "Upcoming activities"}
        actions={
          <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-forest-900/10" role="group" aria-label="View">
            <Link href={`/activities${filtersToSearch(f, { view: "cards", month: undefined })}`} aria-current={f.view === "cards" ? "page" : undefined}
              className={cn("btn btn-sm", f.view === "cards" ? "bg-forest-800 text-white" : "text-forest-900")}><LayoutGrid className="h-4 w-4" aria-hidden /> Cards</Link>
            <Link href={`/activities${filtersToSearch(f, { view: "calendar", past: false })}`} aria-current={f.view === "calendar" ? "page" : undefined}
              className={cn("btn btn-sm", f.view === "calendar" ? "bg-forest-800 text-white" : "text-forest-900")}><CalendarDays className="h-4 w-4" aria-hidden /> Calendar</Link>
          </div>
        }>
        {category?.description ?? "Every activity is curated by our organizers. Apply for the ones that match your experience — selections are made fairly based on our published criteria."}
      </PageHeader>

      <EventFiltersForm f={f} categories={categories} regions={regions} />

      <div className="mt-8">
        {f.view === "calendar" ? (
          <EventCalendar month={month} events={events} f={f} />
        ) : events.length === 0 ? (
          <EmptyState title="No activities match those filters" action={<Link href="/activities" className="btn-secondary">Clear filters</Link>}>
            Try widening your dates or area — or suggest the trip you&apos;re dreaming of.
          </EmptyState>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted" aria-live="polite">{events.length} {events.length === 1 ? "activity" : "activities"}</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e, i) => <EventCard key={e.id} e={e} priority={i < 3} />)}
            </div>
          </>
        )}
      </div>
      {f.view === "cards" && (
        <div className="mt-10 text-center">
          <Link href={`/activities${filtersToSearch(f, { past: !f.past })}`} className="btn-ghost">{f.past ? "Show upcoming activities" : "Browse past activities"}</Link>
        </div>
      )}
    </div>
  );
}
