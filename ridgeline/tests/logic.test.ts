import { describe, expect, it } from "vitest";
import { applyFilters, distanceBucket, durationBucket, filtersToSearch, parseFilters, regionWithDescendants } from "@/lib/filters";
import { buildIcs } from "@/lib/ics";
import { formatDuration, formatMoney, localDay } from "@/lib/format";
import { isoToLocalInput, localInputToIso, zonedToUtc } from "@/lib/time";
import { isVisible } from "@/lib/event-fields";
import { materializeEvents } from "@/lib/demo/materialize";
import type { EventListing, Region } from "@/lib/types";

const regions: Region[] = [
  { id: "ca", parent_id: null, kind: "country", name: "Canada", slug: "canada", active: true, sort_order: 0 },
  { id: "bc", parent_id: "ca", kind: "province", name: "BC", slug: "british-columbia", active: true, sort_order: 0 },
  { id: "nv", parent_id: "bc", kind: "area", name: "North Vancouver", slug: "north-vancouver", active: true, sort_order: 1 },
  { id: "ab", parent_id: "ca", kind: "province", name: "Alberta", slug: "alberta", active: true, sort_order: 1 },
  { id: "cg", parent_id: "ab", kind: "area", name: "Calgary", slug: "calgary", active: true, sort_order: 1 },
];

const ev = (over: Partial<EventListing>): EventListing => ({
  id: "e", slug: "e", title: "Dog Mountain", category_id: "c", region_id: "nv", status: "published", featured: false, cover_image_url: null, gallery_urls: [],
  summary: "Snowshoe", description: "", starts_at: "2026-12-05T17:00:00.000Z", ends_at: null, time_zone: "America/Vancouver", general_location: "Seymour",
  distance_km: 5, elevation_gain_m: 150, duration_minutes: 240, difficulty: "easy", group_pace: null, required_experience: "none", experience_notes: null,
  fitness_expectations: null, required_equipment: [], recommended_equipment: [], food_water: null, transportation: null, carpool_enabled: true,
  weather_considerations: null, safety_information: null, max_participants: 10, reserved_spots: 0, registration_opens_at: null, registration_deadline: null,
  cancellation_deadline: null, confirmation_hours: 48, registration_open: true, waitlist_enabled: true, waitlist_mode: "manual", waitlist_offer_hours: 24,
  price_cents: 0, deposit_cents: 0, currency: "CAD", payment_methods: ["none"], payment_deadline: null, cancellation_policy: null, external_links: [],
  custom_sections: [], application_questions: [], hidden_fields: [], restrict_logistics: true, status_note: null, weather_cancellation: false,
  published_at: null, created_at: "", category_slug: "snowshoeing", category_name: "Snowshoeing", category_icon: "snowflake", region_slug: "north-vancouver",
  region_name: "North Vancouver", spots_left: 3, spots_taken: 7, waitlist_count: 0, public_status: "open", ...over,
});

describe("filters", () => {
  it("parses and validates search params", () => {
    const f = parseFilters({ difficulty: "hard", price: "free", from: "2026-13-xx", to: "2026-12-31", view: "calendar" });
    expect(f.difficulty).toBeUndefined();
    expect(f.price).toBe("free");
    expect(f.from).toBeUndefined();
    expect(f.to).toBe("2026-12-31");
    expect(f.view).toBe("calendar");
  });
  it("includes descendant regions so new countries/provinces work without code changes", () => {
    expect(regionWithDescendants("canada", regions).sort()).toEqual(["alberta", "british-columbia", "calgary", "canada", "north-vancouver"].sort());
    const list = [ev({ id: "a" }), ev({ id: "b", region_slug: "calgary" })];
    expect(applyFilters(list, { region: "british-columbia" }, regions).map((e) => e.id)).toEqual(["a"]);
  });
  it("filters by experience ceiling, price, availability and dates", () => {
    const list = [ev({ id: "easy" }), ev({ id: "adv", required_experience: "advanced", price_cents: 2500, public_status: "waitlist" })];
    expect(applyFilters(list, { experience: "beginner" }, regions).map((e) => e.id)).toEqual(["easy"]);
    expect(applyFilters(list, { price: "paid" }, regions).map((e) => e.id)).toEqual(["adv"]);
    expect(applyFilters(list, { availability: "open" }, regions).map((e) => e.id)).toEqual(["easy"]);
    expect(applyFilters(list, { from: "2026-12-06" }, regions)).toHaveLength(0);
  });
  it("buckets distance and duration", () => {
    expect(distanceBucket(5)).toBe("lt8");
    expect(distanceBucket(15)).toBe("8to15");
    expect(durationBucket(1440)).toBe("multi");
    expect(filtersToSearch({ category: "hiking", view: "cards" }, { past: true })).toBe("?category=hiking&past=1");
  });
});

describe("time zone handling (America/Vancouver)", () => {
  it("converts wall-clock times across DST", () => {
    expect(zonedToUtc("2026-07-01", "09:00")).toBe("2026-07-01T16:00:00.000Z"); // PDT (UTC-7)
    expect(zonedToUtc("2026-01-15", "09:00")).toBe("2026-01-15T17:00:00.000Z"); // PST (UTC-8)
    // Uses the IANA database rather than hard-coded offsets (tzdata 2026e+ moves BC to permanent UTC-7),
    // so verify round trips for dates across the year instead of assuming a rule.
    for (const local of ["2026-03-08T09:00", "2026-11-01T08:30", "2026-12-05T08:30", "2027-06-20T18:45"]) {
      expect(isoToLocalInput(localInputToIso(local)!)).toBe(local);
    }
    expect(localDay("2026-01-15T07:00:00.000Z")).toBe("2026-01-14");
  });
});

describe("formatting", () => {
  it("formats money and durations", () => {
    expect(formatMoney(0)).toBe("Free");
    expect(formatMoney(2500)).toBe("$25");
    expect(formatMoney(1050)).toBe("$10.50");
    expect(formatDuration(330)).toBe("5h 30m");
    expect(formatDuration(1440)).toBe("1 day");
  });
  it("respects hidden fields", () => {
    expect(isVisible(["elevation_gain_m"], "elevation_gain_m")).toBe(false);
    expect(isVisible(null, "distance_km")).toBe(true);
  });
});

describe("calendar file", () => {
  it("produces a valid VEVENT with escaped text and folded lines", () => {
    const ics = buildIcs({ id: "abc", title: "Hike, with; commas", starts_at: "2026-12-05T17:00:00.000Z", ends_at: null,
      location: "Mt Seymour P1", description: "x".repeat(200), url: "https://example.com/activities/a/hub", brand: "Ridgeline" });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20261205T170000Z");
    expect(ics).toContain("DTEND:20261205T200000Z");
    expect(ics).toContain(String.raw`SUMMARY:Hike\, with\; commas`);
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});

describe("demo dataset", () => {
  it("is internally consistent", () => {
    const { rows, apps } = materializeEvents();
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
    for (const r of rows) {
      const taken = apps.filter((a) => rows.find((x) => x._key === a.event_key)?.id === r.id && ["confirmed", "approved", "attended", "no_show"].includes(a.status)).length;
      expect(taken, r.slug).toBeLessThanOrEqual(r.max_participants);
      if (r.ends_at) expect(Date.parse(r.ends_at)).toBeGreaterThanOrEqual(Date.parse(r.starts_at));
    }
  });
});
