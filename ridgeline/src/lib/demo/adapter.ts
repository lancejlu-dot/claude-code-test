import "server-only";
import base from "./base-content.json";
import { members, suggestions as demoSuggestions } from "./data";
import { materializeEvents, materializeHighlights, memberId } from "./materialize";
import type {
  BrandSettings, Category, CommunityStats, EventListing, EventPrivateDetails, Faq, Highlight, HomepageSettings,
  PolicyPage, PublicProfile, PublicStatus, Region,
} from "../types";

export const demoCategories = base.categories as Category[];
export const demoRegions = base.regions as Region[];
export const demoFaqs = base.faqs as Faq[];
export const demoPolicies = base.policies as PolicyPage[];
export const demoBrand = base.settings.brand as BrandSettings;
export const demoHomepage = base.settings.homepage as unknown as HomepageSettings;

function publicStatus(e: { status: string; starts_at: string; ends_at: string | null; registration_opens_at: string | null;
  registration_deadline: string | null; registration_open: boolean; waitlist_enabled: boolean }, left: number): PublicStatus {
  const now = Date.now();
  if (e.status === "draft") return "draft";
  if (e.status === "cancelled") return "cancelled";
  if (e.status === "completed" || Date.parse(e.ends_at ?? e.starts_at) < now) return "completed";
  if (e.status === "postponed") return "postponed";
  if (e.registration_opens_at && Date.parse(e.registration_opens_at) > now) return "upcoming";
  if (!e.registration_open || (e.registration_deadline && Date.parse(e.registration_deadline) < now) || Date.parse(e.starts_at) <= now) return "closed";
  if (left <= 0) return e.waitlist_enabled ? "waitlist" : "full";
  return "open";
}

let cache: { at: number; events: EventListing[]; privates: EventPrivateDetails[]; organizers: Map<string, string[]> } | null = null;

function load() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const { rows, privates, apps } = materializeEvents();
  const organizers = new Map<string, string[]>();
  const events: EventListing[] = rows.filter((r) => r.status !== "draft").map((r) => {
    const cat = demoCategories.find((c) => c.slug === r._category)!;
    const reg = demoRegions.find((x) => x.slug === r._region);
    const mine = apps.filter((a) => a.event_key === r._key);
    const taken = mine.filter((a) => ["confirmed", "approved", "attended", "no_show"].includes(a.status)).length;
    const left = Math.max(r.max_participants - r.reserved_spots - taken, 0);
    organizers.set(r.id, r._organizers);
    const { _key, _category, _region, _organizers, _waivers, ...row } = r;
    void _key; void _category; void _region; void _organizers; void _waivers;
    return {
      ...row, category_id: cat.id, region_id: reg?.id ?? null,
      category_slug: cat.slug, category_name: cat.name, category_icon: cat.icon,
      region_slug: reg?.slug ?? null, region_name: reg?.name ?? null,
      spots_taken: taken, spots_left: left, waitlist_count: mine.filter((a) => a.status === "waitlisted").length,
      public_status: publicStatus(row, left),
    };
  });
  cache = { at: Date.now(), events, privates, organizers };
  return cache;
}

export const demoEvents = () => load().events;

export function demoProfile(key: string): PublicProfile {
  const m = members.find((x) => x.key === key)!;
  const { rows, apps } = materializeEvents();
  void rows;
  return {
    id: memberId(key), first_name: m.first, last_initial: m.last[0], display_name: `${m.first} ${m.last[0]}.`, avatar_url: null,
    intro: m.intro, interests: m.interests, hiking_experience: m.experience, experience_summary: m.experience_summary ?? null,
    skills_certifications: m.skills ?? [], languages: m.languages ?? ["English"],
    member_since: new Date(Date.now() - m.joinedDaysAgo * 86400_000).toISOString(),
    completed_count: apps.filter((a) => a.member_key === key && a.status === "attended").length,
    badges: (m.badges ?? []).map((b) => ({ name: b.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), icon: "award", description: null })),
  };
}

export function demoOrganizers(eventId: string) {
  const keys = load().organizers.get(eventId) ?? [];
  return keys.map((k, i) => ({ ...demoProfile(k), is_lead: i === 0 }));
}

export function demoPrivateDetails(eventId: string, ev: EventListing) {
  if (ev.restrict_logistics) return null;
  return load().privates.find((p) => p.event_id === eventId) ?? null;
}

export const demoHighlights = () => materializeHighlights() as Highlight[];

export function demoStats(): CommunityStats {
  const { apps, rows } = materializeEvents();
  const attended = apps.filter((a) => a.status === "attended");
  const evs = load().events;
  const distance = new Map(rows.map((r) => [r._key, r.distance_km ?? 0]));
  const km = attended.reduce((s, a) => s + (distance.get(a.event_key) ?? 0), 0);
  const counted = apps.filter((a) => a.attendance);
  return {
    members: members.filter((m) => (m.status ?? "active") === "active").length,
    events_completed: evs.filter((e) => e.public_status === "completed").length,
    participations: attended.length,
    km_travelled: Math.round(km),
    attendance_rate: counted.length ? Math.round((100 * attended.length) / counted.length) : null,
  };
}

export const demoSuggestionCount = demoSuggestions.length;
