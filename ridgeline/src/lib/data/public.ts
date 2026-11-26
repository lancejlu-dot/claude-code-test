import "server-only";
import { cache } from "react";
import { isDemoMode } from "../env";
import { createClient } from "../supabase/server";
import { applyFilters, type EventFilters } from "../filters";
import * as demo from "../demo/adapter";
import type {
  BrandSettings, Category, CommunityStats, EventListing, EventPrivateDetails, Faq, Highlight, HomepageSettings,
  PolicyPage, Region,
} from "../types";

/** Public read model for the marketing site and discovery. Falls back to fictional demo data in demo mode. */

export const getBrand = cache(async (): Promise<BrandSettings> => {
  if (isDemoMode) return demo.demoBrand;
  const sb = await createClient();
  const { data } = await sb.from("site_settings").select("value").eq("key", "brand").maybeSingle();
  return { ...demo.demoBrand, ...((data?.value as Partial<BrandSettings>) ?? {}) };
});

export const getHomepage = cache(async (): Promise<HomepageSettings> => {
  if (isDemoMode) return demo.demoHomepage;
  const sb = await createClient();
  const { data } = await sb.from("site_settings").select("value").eq("key", "homepage").maybeSingle();
  return { ...demo.demoHomepage, ...((data?.value as Partial<HomepageSettings>) ?? {}) };
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (isDemoMode) return demo.demoCategories;
  const sb = await createClient();
  const { data } = await sb.from("activity_categories").select("*").eq("active", true).order("sort_order");
  return (data ?? []) as Category[];
});

export const getRegions = cache(async (): Promise<Region[]> => {
  if (isDemoMode) return demo.demoRegions;
  const sb = await createClient();
  const { data } = await sb.from("regions").select("*").eq("active", true).order("sort_order");
  return (data ?? []) as Region[];
});

/** Upcoming (or past) published events matching filters. Filtering by computed availability happens in memory. */
export async function listEvents(f: EventFilters = {}, opts: { limit?: number; featuredOnly?: boolean } = {}): Promise<EventListing[]> {
  const regions = await getRegions();
  let rows: EventListing[];
  const nowIso = new Date().toISOString();
  if (isDemoMode) {
    rows = demo.demoEvents();
  } else {
    const sb = await createClient();
    let q = sb.from("event_listing").select("*").neq("status", "draft");
    if (f.past) q = q.lt("starts_at", nowIso).order("starts_at", { ascending: false }).limit(60);
    else q = q.or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`).order("starts_at").limit(200);
    if (f.category) q = q.eq("category_slug", f.category);
    if (f.difficulty) q = q.eq("difficulty", f.difficulty);
    if (f.price === "free") q = q.eq("price_cents", 0);
    if (f.price === "paid") q = q.gt("price_cents", 0);
    const { data, error } = await q;
    if (error) throw error;
    rows = (data ?? []) as EventListing[];
  }
  if (isDemoMode) {
    rows = rows
      .filter((e) => (f.past ? Date.parse(e.starts_at) < Date.now() : Date.parse(e.ends_at ?? e.starts_at) >= Date.now()))
      .sort((a, b) => (f.past ? -1 : 1) * (Date.parse(a.starts_at) - Date.parse(b.starts_at)));
  }
  let out = applyFilters(rows, f, regions);
  if (opts.featuredOnly) out = out.filter((e) => e.featured);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** Events for a calendar month (includes cancelled/postponed so members see changes). */
export async function listEventsForMonth(month: string, f: EventFilters): Promise<EventListing[]> {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 86400_000).toISOString();
  const end = new Date(Date.UTC(y, m, 1) + 86400_000).toISOString();
  const regions = await getRegions();
  let rows: EventListing[];
  if (isDemoMode) rows = demo.demoEvents();
  else {
    const sb = await createClient();
    const { data } = await sb.from("event_listing").select("*").neq("status", "draft").gte("starts_at", start).lt("starts_at", end).order("starts_at");
    rows = (data ?? []) as EventListing[];
  }
  return applyFilters(rows.filter((e) => e.starts_at >= start && e.starts_at < end), { ...f, from: undefined, to: undefined }, regions)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export const getEventBySlug = cache(async (slug: string): Promise<EventListing | null> => {
  if (isDemoMode) return demo.demoEvents().find((e) => e.slug === slug) ?? null;
  const sb = await createClient();
  const { data } = await sb.from("event_listing").select("*").eq("slug", slug).maybeSingle();
  return (data as EventListing) ?? null;
});

/** Exact logistics. RLS returns nothing unless unrestricted, or the viewer is a selected participant / staff. */
export async function getPrivateDetails(ev: EventListing): Promise<EventPrivateDetails | null> {
  if (isDemoMode) return demo.demoPrivateDetails(ev.id, ev);
  const sb = await createClient();
  const { data } = await sb.from("event_private_details").select("*").eq("event_id", ev.id).maybeSingle();
  return (data as EventPrivateDetails) ?? null;
}

export async function getOrganizers(eventId: string) {
  if (isDemoMode) return demo.demoOrganizers(eventId);
  const sb = await createClient();
  const { data } = await sb.rpc("event_organizer_profiles", { p_event: eventId });
  return (data ?? []) as { user_id: string; display_name: string; avatar_url: string | null; intro: string; is_lead: boolean; completed_count: number }[];
}

export const getFaqs = cache(async (): Promise<Faq[]> => {
  if (isDemoMode) return demo.demoFaqs;
  const sb = await createClient();
  const { data } = await sb.from("faqs").select("*").eq("published", true).order("sort_order");
  return (data ?? []) as Faq[];
});

export const getPolicies = cache(async (): Promise<PolicyPage[]> => {
  if (isDemoMode) return demo.demoPolicies;
  const sb = await createClient();
  const { data } = await sb.from("policy_pages").select("*").eq("published", true).order("sort_order");
  return (data ?? []) as PolicyPage[];
});

export async function getPolicy(slug: string) {
  return (await getPolicies()).find((p) => p.slug === slug) ?? null;
}

export async function getHighlights(): Promise<Highlight[]> {
  if (isDemoMode) return demo.demoHighlights();
  const sb = await createClient();
  const { data } = await sb.from("highlights").select("*").eq("published", true).eq("consent_confirmed", true).order("sort_order").limit(8);
  return (data ?? []) as Highlight[];
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const home = await getHomepage();
  let stats: CommunityStats;
  if (isDemoMode) stats = demo.demoStats();
  else {
    const sb = await createClient();
    const { data } = await sb.rpc("community_stats");
    stats = data as CommunityStats;
  }
  return { ...stats, ...(home.stats_override ?? {}) };
}
