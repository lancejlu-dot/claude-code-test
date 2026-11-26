"use client";
import { useEffect, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Category, Region } from "@/lib/types";
import type { EventFilters } from "@/lib/filters";

/** GET form: works without JavaScript; auto-submits on change when JS is available. */
export function EventFiltersForm({ f, categories, regions }: { f: EventFilters; categories: Category[]; regions: Region[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  // Collapsed by default on small screens, open on desktop.
  useEffect(() => { if (details.current && window.matchMedia("(max-width: 1023px)").matches) details.current.open = false; }, []);
  const submit = () => ref.current?.requestSubmit();
  const areas = regions.filter((r) => r.kind === "area");
  const groups = regions.filter((r) => r.kind !== "area");
  const sel = "input py-2 text-sm";
  const active = Object.entries(f).filter(([k, v]) => v && !["view", "month", "past"].includes(k)).length;
  return (
    <form ref={ref} method="get" action="/activities" onChange={submit} className="card p-4" aria-label="Filter activities">
      {f.view === "calendar" && <input type="hidden" name="view" value="calendar" />}
      {f.month && <input type="hidden" name="month" value={f.month} />}
      {f.past && <input type="hidden" name="past" value="1" />}
      <details ref={details} className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 lg:hidden">
          <span className="flex items-center gap-2 font-semibold text-forest-950"><SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters{active ? ` (${active})` : ""}</span>
          <span className="text-sm text-muted group-open:hidden">Show</span><span className="hidden text-sm text-muted group-open:inline">Hide</span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="q" className="sr-only">Search</label>
            <input id="q" name="q" defaultValue={f.q} placeholder="Search trails, places…" className={sel} />
          </div>
          <Select name="category" label="Activity" value={f.category} options={categories.map((c) => [c.slug, c.name])} cls={sel} />
          <div>
            <label htmlFor="region" className="sr-only">Area</label>
            <select id="region" name="region" defaultValue={f.region ?? ""} className={sel}>
              <option value="">All areas</option>
              {groups.map((g) => <option key={g.slug} value={g.slug}>All of {g.name}</option>)}
              <optgroup label="Lower Mainland">{areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}</optgroup>
            </select>
          </div>
          <Select name="difficulty" label="Difficulty" value={f.difficulty} cls={sel}
            options={[["easy", "Easy"], ["moderate", "Moderate"], ["challenging", "Challenging"], ["strenuous", "Strenuous"], ["expert", "Expert"]]} />
          <Select name="availability" label="Availability" value={f.availability} cls={sel} options={[["open", "Spots available"], ["waitlist", "Open or waitlist"]]} />
          <div className="flex items-center gap-2">
            <label htmlFor="from" className="sr-only">From date</label>
            <input id="from" type="date" name="from" defaultValue={f.from} className={sel} aria-label="From date" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="to" className="sr-only">To date</label>
            <input id="to" type="date" name="to" defaultValue={f.to} className={sel} aria-label="To date" />
          </div>
          <Select name="duration" label="Duration" value={f.duration} cls={sel} options={[["short", "Under 2 hours"], ["half", "Half day (2–5h)"], ["full", "Full day"], ["multi", "Overnight / multi-day"]]} />
          <Select name="distance" label="Distance" value={f.distance} cls={sel} options={[["lt8", "Under 8 km"], ["8to15", "8–15 km"], ["gt15", "Over 15 km"]]} />
          <Select name="price" label="Price" value={f.price} cls={sel} options={[["free", "Free"], ["paid", "Paid"]]} />
          <Select name="experience" label="My experience" value={f.experience} cls={sel}
            options={[["none", "No experience needed"], ["beginner", "Beginner-friendly"], ["intermediate", "Up to intermediate"], ["advanced", "Up to advanced"]]} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="btn-primary btn-sm">Apply filters</button>
          {active > 0 && <a href={`/activities${f.view === "calendar" ? "?view=calendar" : ""}`} className="btn-ghost btn-sm">Clear all</a>}
        </div>
      </details>
    </form>
  );
}

function Select({ name, label, value, options, cls }: { name: string; label: string; value?: string; options: [string, string][]; cls: string }) {
  return (
    <div>
      <label htmlFor={name} className="sr-only">{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""} className={cls}>
        <option value="">{label}: any</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
