/**
 * Turns the relative demo dataset into concrete rows (ids, timestamps).
 * Shared by the seed generator and demo mode so both show identical data.
 */
import { events as demoEvents, members, highlights as demoHighlights, type DemoAppStatus, type DemoEvent } from "./data";
import type { EventRow, EventPrivateDetails } from "../types";
import { zonedToUtc } from "../time";
export { zonedToUtc };

export const TZ = "America/Vancouver";

const pad = (n: number) => String(n).padStart(12, "0");
export const memberId = (key: string) => `10000000-0000-4000-8000-${pad(members.findIndex((m) => m.key === key) + 1)}`;
export const eventId = (key: string) => `20000000-0000-4000-8000-${pad(demoEvents.findIndex((e) => e.key === key) + 1)}`;

/** YYYY-MM-DD of "today" in the community time zone, shifted by `offset` days. */
export function localDate(offset: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}

export interface MaterializedApp {
  id: string;
  event_key: string;
  member_key: string;
  status: DemoAppStatus;
  attendance: "attended" | "unexcused_no_show" | null;
  waitlist_position: number | null;
}

export function materializeEvents(now = new Date()) {
  const rows: (EventRow & { _key: string; _category: string; _region: string; _organizers: string[]; _waivers: string[] })[] = [];
  const privates: EventPrivateDetails[] = [];
  const apps: MaterializedApp[] = [];
  let appSeq = 0;

  for (const e of demoEvents) {
    const id = eventId(e.key);
    const startsAt = zonedToUtc(localDate(e.dayOffset, now), e.start);
    const endsAt = zonedToUtc(localDate(e.endDayOffset ?? e.dayOffset, now), e.end);
    const startMs = Date.parse(startsAt);
    const hoursBefore = (h?: number) => (h == null ? null : new Date(startMs - h * 3600_000).toISOString());
    rows.push({
      _key: e.key, _category: e.category, _region: e.region, _organizers: e.organizers, _waivers: e.waivers ?? [],
      id, slug: e.slug, title: e.title, category_id: e.category, region_id: e.region, status: e.status,
      featured: e.featured ?? false, cover_image_url: e.cover, gallery_urls: [], summary: e.summary, description: e.description,
      starts_at: startsAt, ends_at: endsAt, time_zone: TZ, general_location: e.general_location,
      distance_km: e.distance_km ?? null, elevation_gain_m: e.elevation_gain_m ?? null, duration_minutes: e.duration_minutes ?? null,
      difficulty: e.difficulty, group_pace: e.group_pace ?? null, required_experience: e.required_experience,
      experience_notes: e.experience_notes ?? null, fitness_expectations: e.fitness_expectations ?? null,
      required_equipment: e.required_equipment ?? [], recommended_equipment: e.recommended_equipment ?? [],
      food_water: e.food_water ?? null, transportation: e.transportation ?? null, carpool_enabled: true,
      weather_considerations: e.weather_considerations ?? null, safety_information: e.safety_information ?? null,
      max_participants: e.max_participants, reserved_spots: e.reserved_spots ?? 0,
      registration_opens_at: e.registration_opens_offset_days != null ? zonedToUtc(localDate(e.registration_opens_offset_days, now), "09:00") : null,
      registration_deadline: hoursBefore(e.registration_deadline_offset_hours),
      cancellation_deadline: hoursBefore(e.cancellation_hours ?? 48),
      confirmation_hours: 48, registration_open: e.status === "published" || e.status === "postponed",
      waitlist_enabled: true, waitlist_mode: e.waitlist_mode ?? "manual", waitlist_offer_hours: 24,
      price_cents: e.price_cents ?? 0, deposit_cents: e.deposit_cents ?? 0, currency: "CAD",
      payment_methods: e.payment_methods ?? ["none"], payment_deadline: null, cancellation_policy: e.cancellation_policy ?? null,
      external_links: e.external_links ?? [], custom_sections: e.custom_sections ?? [], application_questions: e.questions ?? [],
      hidden_fields: e.hidden_fields ?? [], restrict_logistics: e.restrict_logistics ?? true,
      status_note: e.status_note ?? null, weather_cancellation: e.weather_cancellation ?? false,
      published_at: e.status === "draft" ? null : new Date(startMs - 21 * 86400_000).toISOString(),
      created_at: new Date(startMs - 28 * 86400_000).toISOString(),
    });
    privates.push({
      event_id: id, meeting_location: e.private.meeting_location, meeting_location_url: e.private.meeting_location_url ?? null,
      meeting_time_note: e.private.meeting_time_note ?? null, parking_information: e.private.parking_information ?? null,
      carpool_details: e.private.carpool_details ?? null, additional_instructions: e.private.additional_instructions ?? null,
      organizer_phone_note: null,
    });
    let wl = 0;
    for (const [status, keys] of Object.entries(e.applicants) as [DemoAppStatus, string[]][]) {
      for (const k of keys ?? []) {
        appSeq++;
        apps.push({
          id: `30000000-0000-4000-8000-${pad(appSeq)}`, event_key: e.key, member_key: k, status,
          attendance: status === "attended" ? "attended" : status === "no_show" ? "unexcused_no_show" : null,
          waitlist_position: status === "waitlisted" ? ++wl : null,
        });
      }
    }
  }
  return { rows, privates, apps };
}

export function materializeHighlights() {
  return demoHighlights.map((h, i) => ({
    id: `40000000-0000-4000-8000-${pad(i + 1)}`, event_id: eventId(h.event), title: h.title, caption: h.caption,
    image_url: h.image, consent_confirmed: true, published: true, sort_order: i,
  }));
}

export type MaterializedEvent = ReturnType<typeof materializeEvents>["rows"][number];
export type { DemoEvent };
