import { difficultyRank, localDay } from "./format";
import type { Difficulty, EventListing, ExperienceLevel, Region } from "./types";

export interface EventFilters {
  category?: string;
  region?: string;
  difficulty?: Difficulty;
  from?: string; // YYYY-MM-DD
  to?: string;
  duration?: "short" | "half" | "full" | "multi";
  distance?: "lt8" | "8to15" | "gt15";
  price?: "free" | "paid";
  availability?: "open" | "waitlist";
  experience?: ExperienceLevel;
  q?: string;
  view?: "cards" | "calendar";
  month?: string; // YYYY-MM for calendar
  past?: boolean;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(sp: Record<string, string | string[] | undefined>): EventFilters {
  const from = one(sp.from);
  const to = one(sp.to);
  const month = one(sp.month);
  return {
    category: one(sp.category),
    region: one(sp.region),
    difficulty: pick(one(sp.difficulty), ["easy", "moderate", "challenging", "strenuous", "expert"] as const),
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    duration: pick(one(sp.duration), ["short", "half", "full", "multi"] as const),
    distance: pick(one(sp.distance), ["lt8", "8to15", "gt15"] as const),
    price: pick(one(sp.price), ["free", "paid"] as const),
    availability: pick(one(sp.availability), ["open", "waitlist"] as const),
    experience: pick(one(sp.experience), ["none", "beginner", "intermediate", "advanced", "expert"] as const),
    q: one(sp.q)?.slice(0, 80),
    view: pick(one(sp.view), ["cards", "calendar"] as const) ?? "cards",
    month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
    past: one(sp.past) === "1",
  };
}

export const durationBucket = (min: number | null) =>
  min == null ? null : min <= 120 ? "short" : min <= 300 ? "half" : min < 1440 ? "full" : "multi";
export const distanceBucket = (km: number | null) => (km == null ? null : km < 8 ? "lt8" : km <= 15 ? "8to15" : "gt15");

const EXP_ORDER: ExperienceLevel[] = ["none", "beginner", "intermediate", "advanced", "expert"];

/** Region slug plus all descendant slugs (supports future country/province hierarchy). */
export function regionWithDescendants(slug: string, regions: Region[]) {
  const root = regions.find((r) => r.slug === slug);
  if (!root) return [slug];
  const out = new Set([root.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of regions) if (r.parent_id && out.has(r.parent_id) && !out.has(r.id)) { out.add(r.id); grew = true; }
  }
  return regions.filter((r) => out.has(r.id)).map((r) => r.slug);
}

/** Applies filters in memory. Used by demo mode and as a post-filter for computed fields. */
export function applyFilters(events: EventListing[], f: EventFilters, regions: Region[]) {
  const regionSlugs = f.region ? regionWithDescendants(f.region, regions) : null;
  const q = f.q?.toLowerCase();
  return events.filter((e) => {
    if (f.category && e.category_slug !== f.category) return false;
    if (regionSlugs && !regionSlugs.includes(e.region_slug ?? "")) return false;
    if (f.difficulty && e.difficulty !== f.difficulty) return false;
    if (f.from && localDay(e.starts_at) < f.from) return false;
    if (f.to && localDay(e.starts_at) > f.to) return false;
    if (f.duration && durationBucket(e.duration_minutes) !== f.duration) return false;
    if (f.distance && distanceBucket(e.distance_km) !== f.distance) return false;
    if (f.price === "free" && e.price_cents > 0) return false;
    if (f.price === "paid" && e.price_cents === 0) return false;
    if (f.availability === "open" && e.public_status !== "open") return false;
    if (f.availability === "waitlist" && !["open", "waitlist"].includes(e.public_status)) return false;
    if (f.experience && EXP_ORDER.indexOf(e.required_experience) > EXP_ORDER.indexOf(f.experience)) return false;
    if (q && !`${e.title} ${e.summary ?? ""} ${e.general_location ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export const sortByDifficulty = (a: EventListing, b: EventListing) =>
  (a.difficulty ? difficultyRank[a.difficulty] : 0) - (b.difficulty ? difficultyRank[b.difficulty] : 0);

export function filtersToSearch(f: EventFilters, patch: Partial<EventFilters> = {}) {
  const merged = { ...f, ...patch } as Record<string, unknown>;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === false || v === "" || (k === "view" && v === "cards")) continue;
    p.set(k, v === true ? "1" : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
