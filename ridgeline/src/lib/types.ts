// Shared domain types. Column names mirror the database (snake_case) so rows
// from Supabase and the demo dataset share one shape.

export type MemberStatus = "pending" | "active" | "restricted" | "suspended" | "removed" | "rejected";
export type StaffRole = "owner" | "admin" | "organizer" | "moderator";
export type EventStatus = "draft" | "published" | "postponed" | "cancelled" | "completed";
export type PublicStatus =
  | "draft" | "open" | "waitlist" | "full" | "closed" | "completed" | "cancelled" | "postponed" | "upcoming";
export type ApplicationStatus =
  | "submitted" | "under_review" | "approved" | "awaiting_confirmation" | "confirmed"
  | "waitlisted" | "not_selected" | "cancelled" | "attended" | "no_show";
export type AttendanceOutcome =
  | "attended" | "cancelled_in_period" | "late_cancellation" | "excused_absence" | "unexcused_no_show" | "event_cancelled";
export type PaymentStatus = "pending" | "paid" | "refunded" | "partially_refunded" | "waived" | "failed";
export type PaymentMethod = "online" | "cash" | "none";
export type Difficulty = "easy" | "moderate" | "challenging" | "strenuous" | "expert";
export type ExperienceLevel = "none" | "beginner" | "intermediate" | "advanced" | "expert";
export type WaitlistMode = "manual" | "automatic";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  hidden_fields: string[];
  tracks_distance: boolean;
  active: boolean;
  sort_order: number;
}

export interface Region {
  id: string;
  parent_id: string | null;
  kind: "country" | "province" | "area";
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
}

export interface LinkItem { label: string; url: string }
export interface CustomSection { title: string; items: string[] }
export interface ApplicationQuestion {
  id: string;
  label: string;
  help?: string;
  required: boolean;
  type: "text" | "yesno";
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  region_id: string | null;
  status: EventStatus;
  featured: boolean;
  cover_image_url: string | null;
  gallery_urls: string[];
  summary: string | null;
  description: string;
  starts_at: string;
  ends_at: string | null;
  time_zone: string;
  general_location: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  duration_minutes: number | null;
  difficulty: Difficulty | null;
  group_pace: string | null;
  required_experience: ExperienceLevel;
  experience_notes: string | null;
  fitness_expectations: string | null;
  required_equipment: string[];
  recommended_equipment: string[];
  food_water: string | null;
  transportation: string | null;
  carpool_enabled: boolean;
  weather_considerations: string | null;
  safety_information: string | null;
  max_participants: number;
  reserved_spots: number;
  registration_opens_at: string | null;
  registration_deadline: string | null;
  cancellation_deadline: string | null;
  confirmation_hours: number | null;
  registration_open: boolean;
  waitlist_enabled: boolean;
  waitlist_mode: WaitlistMode;
  waitlist_offer_hours: number;
  price_cents: number;
  deposit_cents: number;
  currency: string;
  payment_methods: PaymentMethod[];
  payment_deadline: string | null;
  cancellation_policy: string | null;
  external_links: LinkItem[];
  custom_sections: CustomSection[];
  application_questions: ApplicationQuestion[];
  hidden_fields: string[];
  restrict_logistics: boolean;
  status_note: string | null;
  weather_cancellation: boolean;
  published_at: string | null;
  created_at: string;
}

/** Row of the `event_listing` view. */
export interface EventListing extends EventRow {
  category_slug: string;
  category_name: string;
  category_icon: string;
  region_slug: string | null;
  region_name: string | null;
  spots_left: number;
  spots_taken: number;
  waitlist_count: number;
  public_status: PublicStatus;
}

export interface EventPrivateDetails {
  event_id: string;
  meeting_location: string | null;
  meeting_location_url: string | null;
  meeting_time_note: string | null;
  parking_information: string | null;
  carpool_details: string | null;
  additional_instructions: string | null;
  organizer_phone_note: string | null;
}

export interface PublicProfile {
  id: string;
  first_name: string;
  last_initial: string;
  display_name: string;
  avatar_url: string | null;
  intro: string;
  interests: string[];
  hiking_experience: ExperienceLevel | null;
  experience_summary: string | null;
  skills_certifications: string[];
  languages: string[];
  member_since: string;
  completed_count: number;
  badges: { name: string; icon: string; description: string | null }[];
}

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  published: boolean;
  show_on_home: boolean;
}

export interface PolicyPage {
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  legal_reviewed: boolean;
  published: boolean;
  sort_order: number;
  updated_at: string;
}

export interface Highlight {
  id: string;
  event_id: string | null;
  title: string;
  caption: string | null;
  image_url: string;
  consent_confirmed: boolean;
  published: boolean;
  sort_order: number;
}

export interface HomepageSettings {
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  values: { title: string; body: string }[];
  stats_override: Partial<CommunityStats>;
}

export interface BrandSettings {
  name: string;
  tagline: string;
  region_label: string;
  contact_email: string;
}

export interface CommunityStats {
  members: number;
  events_completed: number;
  participations: number;
  km_travelled: number;
  attendance_rate: number | null;
}
