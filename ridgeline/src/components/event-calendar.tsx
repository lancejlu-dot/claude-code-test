import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatTime, localDay } from "@/lib/format";
import { filtersToSearch, type EventFilters } from "@/lib/filters";
import type { EventListing, PublicStatus } from "@/lib/types";

const DOT: Record<PublicStatus, string> = {
  open: "bg-forest-600", waitlist: "bg-ember-500", full: "bg-ink", closed: "bg-sand-500", completed: "bg-sand-300",
  cancelled: "bg-ember-700", postponed: "bg-lake-600", upcoming: "bg-lake-600", draft: "bg-sand-300",
};

export function EventCalendar({ month, events, f }: { month: string; events: EventListing[]; f: EventFilters }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const today = localDay(new Date());
  const byDay = new Map<string, EventListing[]>();
  for (const e of events) { const d = localDay(e.starts_at); byDay.set(d, [...(byDay.get(d) ?? []), e]); }
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1);
  const title = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-forest-900/5 px-4 py-3">
        <Link href={`/activities${filtersToSearch(f, { month: prev, view: "calendar" })}`} className="btn-ghost btn-sm" aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
        <h2 className="text-xl text-forest-950">{title}</h2>
        <Link href={`/activities${filtersToSearch(f, { month: next, view: "calendar" })}`} className="btn-ghost btn-sm" aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      {/* Desktop grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b border-forest-900/5 bg-sand-50 text-center text-xs font-semibold tracking-wide text-muted uppercase">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d >= 1 && d <= daysInMonth;
            const key = inMonth ? `${month}-${String(d).padStart(2, "0")}` : "";
            const list = byDay.get(key) ?? [];
            return (
              <div key={i} className={cn("min-h-28 border-r border-b border-forest-900/5 p-1.5", !inMonth && "bg-sand-50/60", (i + 1) % 7 === 0 && "border-r-0")}>
                {inMonth && <div className={cn("mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs", key === today ? "bg-ember-500 font-bold text-white" : "text-muted")}>{d}</div>}
                <div className="space-y-1">
                  {list.map((e) => (
                    <Link key={e.id} href={`/activities/${e.slug}`} title={e.title}
                      className={cn("block truncate rounded-md px-1.5 py-1 text-[11px] leading-tight hover:bg-moss-100", e.public_status === "cancelled" && "line-through opacity-60")}>
                      <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle", DOT[e.public_status])} />
                      <span className="font-semibold">{formatTime(e.starts_at).replace(":00", "")}</span> {e.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Mobile agenda */}
      <ul className="divide-y divide-forest-900/5 md:hidden">
        {events.length === 0 && <li className="p-6 text-center text-sm text-muted">No activities this month.</li>}
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/activities/${e.slug}`} className="flex gap-4 p-4">
              <div className="w-12 shrink-0 text-center">
                <div className="text-[11px] font-semibold text-ember-600 uppercase">{new Intl.DateTimeFormat("en-CA", { timeZone: e.time_zone, weekday: "short" }).format(new Date(e.starts_at))}</div>
                <div className="font-display text-2xl leading-none">{new Intl.DateTimeFormat("en-CA", { timeZone: e.time_zone, day: "numeric" }).format(new Date(e.starts_at))}</div>
              </div>
              <div className="min-w-0">
                <p className={cn("font-medium text-forest-950", e.public_status === "cancelled" && "line-through")}>{e.title}</p>
                <p className="text-sm text-muted">{formatTime(e.starts_at)} · {e.region_name} · <span className="inline-flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", DOT[e.public_status])} />{e.public_status}</span></p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-4 border-t border-forest-900/5 px-4 py-3 text-xs text-muted">
        {(["open", "waitlist", "closed", "postponed", "cancelled"] as PublicStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", DOT[s])} />{s === "waitlist" ? "Full – waitlist" : s[0].toUpperCase() + s.slice(1)}</span>
        ))}
      </div>
    </div>
  );
}
