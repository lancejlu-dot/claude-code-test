import Link from "next/link";
import { CalendarDays, Clock, MapPin, TrendingUp, Route } from "lucide-react";
import { DifficultyBadge, EventStatusBadge } from "./badges";
import { EventImage } from "./event-image";
import { NamedIcon } from "./icons";
import { formatDate, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { isVisible } from "@/lib/event-fields";
import type { EventListing } from "@/lib/types";

export function EventCard({ e, priority }: { e: EventListing; priority?: boolean }) {
  const show = (k: string) => isVisible(e.hidden_fields, k);
  const spotsNote =
    e.public_status === "open" ? (e.spots_left <= 3 ? `${e.spots_left} spot${e.spots_left === 1 ? "" : "s"} left` : `${e.spots_left} of ${e.max_participants} spots open`)
    : e.public_status === "waitlist" ? `${e.waitlist_count} on waitlist` : null;
  return (
    <Link href={`/activities/${e.slug}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-sand-200">
        <EventImage src={e.cover_image_url} category={e.category_slug} alt="" priority={priority}
          className="transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="chip bg-white/90 text-forest-900 shadow-sm backdrop-blur">
            <NamedIcon name={e.category_icon} className="h-3.5 w-3.5" /> {e.category_name}
          </span>
          <EventStatusBadge status={e.public_status} />
        </div>
        <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-1.5 text-center shadow-sm">
          <div className="text-[10px] font-semibold tracking-wider text-ember-600 uppercase">{formatDate(e.starts_at).split(",")[0]}</div>
          <div className="font-display text-xl leading-none text-forest-950">{new Intl.DateTimeFormat("en-CA", { timeZone: e.time_zone, day: "numeric" }).format(new Date(e.starts_at))}</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-xl leading-snug text-forest-950 group-hover:text-forest-700">{e.title}</h3>
          {e.summary && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{e.summary}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-forest-900/80">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-moss-400" aria-hidden /><dt className="sr-only">Date</dt><dd>{formatDate(e.starts_at)} · {formatTime(e.starts_at)}</dd></div>
          {e.region_name && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-moss-400" aria-hidden /><dt className="sr-only">Area</dt><dd className="truncate">{e.region_name}</dd></div>}
          {show("distance_km") && e.distance_km != null && <div className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5 text-moss-400" aria-hidden /><dt className="sr-only">Distance</dt><dd>{e.distance_km} km</dd></div>}
          {show("elevation_gain_m") && e.elevation_gain_m != null && <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-moss-400" aria-hidden /><dt className="sr-only">Elevation</dt><dd>{e.elevation_gain_m} m gain</dd></div>}
          {show("duration_minutes") && e.duration_minutes != null && !(show("distance_km") && e.distance_km != null && show("elevation_gain_m") && e.elevation_gain_m != null) &&
            <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-moss-400" aria-hidden /><dt className="sr-only">Duration</dt><dd>{formatDuration(e.duration_minutes)}</dd></div>}
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-forest-900/5 pt-3">
          <div className="flex items-center gap-2">
            {show("difficulty") && <DifficultyBadge difficulty={e.difficulty} />}
            <span className="text-sm font-semibold text-forest-900">{formatMoney(e.price_cents, e.currency)}</span>
          </div>
          {spotsNote && <span className="text-xs font-medium text-muted">{spotsNote}</span>}
        </div>
      </div>
    </Link>
  );
}
