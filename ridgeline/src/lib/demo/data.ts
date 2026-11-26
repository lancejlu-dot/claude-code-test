/**
 * FICTIONAL demonstration data for Lower Mainland outdoor activities.
 * - Used to generate supabase/seed.sql (scripts/generate-seed.ts)
 * - Used by "demo mode" (no Supabase configured) to preview public pages.
 * People, emails and phone numbers are invented. Never load this into production.
 *
 * Dates are expressed as day offsets from "today" (America/Vancouver) so the
 * demo always shows upcoming activities, whenever it is seeded.
 */
import type {
  ApplicationQuestion, CustomSection, Difficulty, EventStatus, ExperienceLevel, LinkItem,
  PaymentMethod, StaffRole, WaitlistMode,
} from "../types";

export const DEMO_PASSWORD = "ridgeline-demo-2026"; // local seed only

export interface DemoMember {
  key: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  intro: string;
  interests: string[];
  city: string;
  region: string;
  experience: ExperienceLevel;
  experience_summary?: string;
  skills?: string[];
  languages?: string[];
  has_vehicle?: boolean;
  carpool?: boolean;
  roles?: StaffRole[];
  status?: "active" | "pending" | "restricted";
  joinedDaysAgo: number;
  photo_consent?: boolean;
  badges?: string[];
}

export const members: DemoMember[] = [
  { key: "maya", first: "Maya", last: "Chen", email: "maya.owner@example.com", phone: "604-555-0101",
    intro: "Founder. Happiest on a North Shore ridge with a thermos of tea.", interests: ["hiking","backpacking","snowshoeing"],
    city: "North Vancouver", region: "north-vancouver", experience: "expert", roles: ["owner","admin"], joinedDaysAgo: 720,
    skills: ["Wilderness First Responder","AST 1"], languages: ["English","Mandarin"], has_vehicle: true, carpool: true, badges: ["trip-leader","ten-trips"] },
  { key: "daniel", first: "Daniel", last: "Okafor", email: "daniel.admin@example.com", phone: "604-555-0102",
    intro: "Paddler, planner and spreadsheet enthusiast.", interests: ["kayaking","paddleboarding","camping"],
    city: "Burnaby", region: "burnaby", experience: "advanced", roles: ["admin"], joinedDaysAgo: 610,
    skills: ["Paddle Canada Level 2","Standard First Aid"], has_vehicle: true, carpool: true, badges: ["trip-leader","reliable"] },
  { key: "priya", first: "Priya", last: "Sharma", email: "priya.organizer@example.com", phone: "604-555-0103",
    intro: "Weekend hiker and winter snowshoe lead. I bring the good snacks.", interests: ["hiking","snowshoeing","trail-running"],
    city: "Vancouver", region: "vancouver", experience: "advanced", roles: ["organizer"], joinedDaysAgo: 540,
    skills: ["Standard First Aid","AST 1"], languages: ["English","Hindi"], has_vehicle: true, carpool: true, badges: ["trip-leader","ten-trips"] },
  { key: "liam", first: "Liam", last: "Tremblay", email: "liam.organizer@example.com", phone: "604-555-0104",
    intro: "Ski days, gravel rides and road trips. Ask me about Whistler carpools.", interests: ["skiing-snowboarding","cycling","road-trips"],
    city: "Coquitlam", region: "coquitlam", experience: "advanced", roles: ["organizer"], joinedDaysAgo: 400,
    languages: ["English","French"], has_vehicle: true, carpool: true, badges: ["trip-leader"] },
  { key: "sofia", first: "Sofia", last: "Rossi", email: "sofia.moderator@example.com", phone: "604-555-0105",
    intro: "Trail runner and community moderator.", interests: ["trail-running","outdoor-fitness","hiking"],
    city: "Port Moody", region: "port-moody", experience: "intermediate", roles: ["moderator"], joinedDaysAgo: 380, badges: ["reliable"] },
  { key: "jordan", first: "Jordan", last: "Lee", email: "jordan@example.com", phone: "604-555-0106",
    intro: "New-ish to the North Shore, keen to build up to bigger days.", interests: ["hiking","snowshoeing","skiing-snowboarding"],
    city: "Vancouver", region: "vancouver", experience: "intermediate", joinedDaysAgo: 160, carpool: true, badges: ["first-trip"] },
  { key: "aisha", first: "Aisha", last: "Rahman", email: "aisha@example.com", phone: "604-555-0107",
    intro: "Sunrise hikes and lake swims. Always up for a sunset paddle.", interests: ["hiking","paddleboarding","kayaking"],
    city: "Richmond", region: "richmond", experience: "intermediate", joinedDaysAgo: 300, has_vehicle: true, carpool: true, badges: ["first-trip","reliable"] },
  { key: "ethan", first: "Ethan", last: "Wong", email: "ethan@example.com", phone: "604-555-0108",
    intro: "Engineer by day, trail runner by evening.", interests: ["trail-running","cycling","hiking"],
    city: "Burnaby", region: "burnaby", experience: "advanced", joinedDaysAgo: 280, badges: ["first-trip"] },
  { key: "hannah", first: "Hannah", last: "Kim", email: "hannah@example.com", phone: "604-555-0109",
    intro: "Photographer looking for people to explore with.", interests: ["hiking","camping","backpacking"],
    city: "Surrey", region: "surrey", experience: "intermediate", joinedDaysAgo: 250, photo_consent: true, has_vehicle: true, carpool: true },
  { key: "marco", first: "Marco", last: "Silva", email: "marco@example.com", phone: "604-555-0110",
    intro: "Moved from Lisbon last year. Mountains > beaches (don't tell anyone).", interests: ["hiking","backpacking","road-trips"],
    city: "Vancouver", region: "vancouver", experience: "advanced", languages: ["English","Portuguese"], joinedDaysAgo: 220 },
  { key: "chloe", first: "Chloe", last: "Dubois", email: "chloe@example.com", phone: "604-555-0111",
    intro: "Yoga teacher, aspiring backpacker.", interests: ["outdoor-fitness","hiking","camping"],
    city: "West Vancouver", region: "west-vancouver", experience: "beginner", languages: ["English","French"], joinedDaysAgo: 190 },
  { key: "noah", first: "Noah", last: "Patel", email: "noah@example.com", phone: "604-555-0112",
    intro: "Snowboarder in winter, cyclist in summer.", interests: ["skiing-snowboarding","cycling"],
    city: "Langley", region: "langley", experience: "intermediate", has_vehicle: true, carpool: true, joinedDaysAgo: 170 },
  { key: "emma", first: "Emma", last: "Johansson", email: "emma@example.com", phone: "604-555-0113",
    intro: "Grew up cross-country skiing in Sweden. Loves a cold morning.", interests: ["snowshoeing","skiing-snowboarding","hiking"],
    city: "North Vancouver", region: "north-vancouver", experience: "advanced", languages: ["English","Swedish"], joinedDaysAgo: 140 },
  { key: "kenji", first: "Kenji", last: "Watanabe", email: "kenji@example.com", phone: "604-555-0114",
    intro: "Kayaker and amateur birder.", interests: ["kayaking","hiking"], city: "Maple Ridge", region: "maple-ridge",
    experience: "intermediate", languages: ["English","Japanese"], joinedDaysAgo: 120 },
  { key: "olivia", first: "Olivia", last: "Brown", email: "olivia@example.com", phone: "604-555-0115",
    intro: "Weekend warrior, still learning the trails.", interests: ["hiking","outdoor-fitness"], city: "Surrey", region: "surrey",
    experience: "beginner", status: "restricted", joinedDaysAgo: 90 },
  { key: "sam", first: "Sam", last: "Taylor", email: "sam@example.com", phone: "604-555-0116",
    intro: "Just moved to Squamish and looking for hiking buddies!", interests: ["hiking","trail-running"], city: "Squamish",
    region: "squamish-sea-to-sky", experience: "intermediate", status: "pending", joinedDaysAgo: 1 },
  { key: "ava", first: "Ava", last: "Martin", email: "ava@example.com", phone: "604-555-0117",
    intro: "Nurse, early riser, chronic summit-selfie taker.", interests: ["hiking","snowshoeing"], city: "Coquitlam",
    region: "coquitlam", experience: "intermediate", joinedDaysAgo: 200, skills: ["CPR/AED"] },
  { key: "lucas", first: "Lucas", last: "Nguyen", email: "lucas@example.com", phone: "604-555-0118",
    intro: "Climber trying to convince friends that approach hikes are fun.", interests: ["hiking","backpacking","camping"],
    city: "Vancouver", region: "vancouver", experience: "advanced", joinedDaysAgo: 260 },
  { key: "zoe", first: "Zoe", last: "Campbell", email: "zoe@example.com", phone: "604-555-0119",
    intro: "Paddleboarder and potluck organizer extraordinaire.", interests: ["paddleboarding","social","camping"],
    city: "Port Moody", region: "port-moody", experience: "beginner", joinedDaysAgo: 110 },
  { key: "ben", first: "Ben", last: "Adeyemi", email: "ben@example.com", phone: "604-555-0120",
    intro: "Cyclist, coffee snob, occasional hiker.", interests: ["cycling","hiking","road-trips"],
    city: "New Westminster", region: "burnaby", experience: "intermediate", joinedDaysAgo: 75 },
];

export type DemoAppStatus = "confirmed" | "approved" | "waitlisted" | "submitted" | "under_review" | "attended" | "no_show" | "not_selected";

export interface DemoEvent {
  key: string;
  slug: string;
  title: string;
  category: string;
  region: string;
  status: EventStatus;
  featured?: boolean;
  cover: string;
  summary: string;
  description: string;
  dayOffset: number;
  start: string; // HH:MM local
  endDayOffset?: number;
  end: string;
  general_location: string;
  distance_km?: number;
  elevation_gain_m?: number;
  duration_minutes?: number;
  difficulty: Difficulty;
  group_pace?: string;
  required_experience: ExperienceLevel;
  experience_notes?: string;
  fitness_expectations?: string;
  required_equipment?: string[];
  recommended_equipment?: string[];
  food_water?: string;
  transportation?: string;
  weather_considerations?: string;
  safety_information?: string;
  max_participants: number;
  reserved_spots?: number;
  registration_deadline_offset_hours?: number; // hours before start
  registration_opens_offset_days?: number;     // day offset when registration opens
  cancellation_hours?: number;
  waitlist_mode?: WaitlistMode;
  price_cents?: number;
  deposit_cents?: number;
  payment_methods?: PaymentMethod[];
  cancellation_policy?: string;
  external_links?: LinkItem[];
  custom_sections?: CustomSection[];
  questions?: ApplicationQuestion[];
  hidden_fields?: string[];
  restrict_logistics?: boolean;
  status_note?: string;
  weather_cancellation?: boolean;
  waivers?: string[]; // waiver template ids beyond the general waiver
  organizers: string[]; // member keys, first = lead
  private: {
    meeting_location: string;
    meeting_location_url?: string;
    meeting_time_note?: string;
    parking_information?: string;
    carpool_details?: string;
    additional_instructions?: string;
  };
  applicants: Partial<Record<DemoAppStatus, string[]>>;
}

const TEN_ESSENTIALS = [
  "Navigation (map, compass or GPS with offline map)", "Headlamp with spare batteries", "Sun protection",
  "First-aid kit", "Knife or multi-tool", "Fire starter", "Emergency shelter (bivy or space blanket)",
  "Extra food", "Extra water (at least 2 L)", "Extra insulating layers and rain shell",
];
const WINTER_GEAR = [
  "Snowshoes (rentals available at the resort)", "Waterproof winter boots", "Insulated jacket and spare gloves",
  "Headlamp", "Microspikes for icy sections", "Thermos with a hot drink",
];
const FITNESS_Q: ApplicationQuestion = { id: "recent_hikes", label: "Describe a similar trip you completed in the last 12 months.", required: true, type: "text" };
const PADDLE_PAGE = "00000000-0000-4000-b000-000000000002";
const WINTER_PAGE = "00000000-0000-4000-b000-000000000003";

export const events: DemoEvent[] = [
  {
    key: "dog", slug: "dog-mountain-snowshoe", title: "Dog Mountain Snowshoe & City Views", category: "snowshoeing",
    region: "north-vancouver", status: "published", featured: true, cover: "/images/scenes/snow-forest.svg",
    summary: "A gentle first snowshoe of the season to a viewpoint over the whole city.",
    description: "Our classic beginner snowshoe. We'll wind through quiet old-growth on Mount Seymour to the Dog Mountain viewpoint, with Vancouver, the Fraser River and (on a clear day) Mount Baker laid out below. Perfect if you're new to snowshoeing or want an easy social day in the snow.\n\nWe'll stop for hot drinks at the viewpoint and take our time on the way back.",
    dayOffset: 2, start: "09:00", end: "13:00", general_location: "Mount Seymour Provincial Park",
    distance_km: 5, elevation_gain_m: 150, duration_minutes: 240, difficulty: "easy", group_pace: "Relaxed, with photo stops",
    required_experience: "none", experience_notes: "No snowshoe experience needed — we'll show you the basics.",
    fitness_expectations: "Comfortable walking 2–3 hours on rolling terrain.",
    required_equipment: WINTER_GEAR, recommended_equipment: ["Sit pad", "Sunglasses", "Hand warmers"],
    food_water: "Bring a packed lunch, snacks and at least 1 L of water or a hot drink.",
    transportation: "Mount Seymour Road requires winter tires or chains (Nov 1 – Mar 31).",
    weather_considerations: "We go in light snow. Heavy snowfall or high winds may trigger a postponement 24h ahead.",
    safety_information: "Stay on the marked trail — First Lake area cliffs are hidden by snow. Headcount at trailhead and viewpoint.",
    max_participants: 14, reserved_spots: 1, registration_deadline_offset_hours: 24, cancellation_hours: 48,
    waitlist_mode: "automatic", payment_methods: ["none"], waivers: [WINTER_PAGE],
    external_links: [{ label: "AllTrails: Dog Mountain", url: "https://www.alltrails.com/trail/canada/british-columbia/dog-mountain-trail" },
                     { label: "Mt Seymour conditions", url: "https://mtseymour.ca/conditions" }],
    custom_sections: [{ title: "What to expect", items: ["Hot drink stop at the viewpoint", "Snowshoe technique tips at the start", "Optional post-hike lunch in Deep Cove"] }],
    questions: [{ id: "snowshoe_rental", label: "Do you need to rent snowshoes?", required: true, type: "yesno" }],
    organizers: ["priya", "emma"],
    private: { meeting_location: "Mt Seymour main parking lot (P1), by the Rental Shop entrance",
      meeting_location_url: "https://maps.google.com/?q=Mount+Seymour+Resort", meeting_time_note: "Please arrive 15 minutes early; we leave at 9:00 sharp.",
      parking_information: "Free parking in P1 or P2. Arrive by 8:30 on weekends — lots fill quickly.",
      carpool_details: "Carpools from Parkgate Village (8:00).", additional_instructions: "Organizer cell number will be shared in the participant page on the morning of." },
    applicants: { confirmed: ["jordan","aisha","hannah","chloe","ava","lucas","zoe","ben","kenji"], approved: ["noah"], submitted: ["marco"] },
  },
  {
    key: "quarry", slug: "quarry-rock-sunrise-hike", title: "Quarry Rock Sunrise Hike", category: "hiking",
    region: "north-vancouver", status: "published", cover: "/images/scenes/sunrise-ridge.svg",
    summary: "Short, sweet and spectacular — watch the sun come up over Indian Arm.",
    description: "An early start rewarded with sunrise over Indian Arm from the Quarry Rock bluff. Rooty forest trail with some stairs. We'll grab coffee in Deep Cove afterwards.",
    dayOffset: 3, start: "07:00", end: "09:30", general_location: "Deep Cove, North Vancouver",
    distance_km: 3.8, elevation_gain_m: 100, duration_minutes: 150, difficulty: "easy", group_pace: "Easy, steady",
    required_experience: "beginner", fitness_expectations: "Able to climb stairs and walk on uneven, rooty trail.",
    required_equipment: ["Headlamp (it will be dark at the start)", "Hiking shoes with grip", "Rain jacket"],
    recommended_equipment: ["Microspikes if icy", "Thermos"],
    food_water: "Water and a snack. Coffee afterwards in Deep Cove (optional).",
    transportation: "Transit option: 211/212 bus to Deep Cove.", weather_considerations: "Trail is slippery when wet or frozen.",
    safety_information: "Stay back from the bluff edge, especially in low light.",
    max_participants: 12, registration_deadline_offset_hours: 12, cancellation_hours: 24, payment_methods: ["none"],
    waitlist_mode: "manual", organizers: ["sofia"],
    external_links: [{ label: "AllTrails: Quarry Rock", url: "https://www.alltrails.com/trail/canada/british-columbia/quarry-rock" }],
    private: { meeting_location: "Deep Cove Panorama Park, by the kayak rental", parking_information: "Paid street parking on Gallant Ave; very limited — carpool or transit strongly encouraged." },
    applicants: { confirmed: ["aisha","ethan","hannah","marco","chloe","noah","emma","kenji","ava","lucas","zoe","ben"], waitlisted: ["jordan"] },
  },
  {
    key: "lynn", slug: "lynn-headwaters-norvan-falls", title: "Lynn Headwaters to Norvan Falls", category: "hiking",
    region: "north-vancouver", status: "published", featured: true, cover: "/images/scenes/forest-falls.svg",
    summary: "A long, mellow valley walk through mossy rainforest to a thundering waterfall.",
    description: "A classic rainforest day: we follow Lynn Creek up the valley on the Headwaters trail to Norvan Falls, returning on the Cedars Mill trail. Mostly gentle grade with a few rooty and rocky sections and creek crossings on bridges.",
    dayOffset: 9, start: "09:00", end: "14:30", general_location: "Lynn Headwaters Regional Park",
    distance_km: 14, elevation_gain_m: 350, duration_minutes: 330, difficulty: "moderate", group_pace: "Steady, ~3 km/h with short breaks",
    required_experience: "beginner", fitness_expectations: "Comfortable hiking 5+ hours with a day pack.",
    required_equipment: TEN_ESSENTIALS, recommended_equipment: ["Trekking poles", "Gaiters"],
    food_water: "Lunch, snacks, 2 L water. No water sources we'd recommend drinking untreated.",
    transportation: "Carpools encouraged; the Lynn Headwaters lot is small.",
    weather_considerations: "Expect rain. Creek levels rise after heavy rainfall; organizers will check conditions.",
    safety_information: "Register at the trailhead board. Regroup at every junction. Turnaround time 12:00.",
    max_participants: 12, reserved_spots: 0, registration_deadline_offset_hours: 48, cancellation_hours: 48,
    payment_methods: ["none"], organizers: ["priya"], questions: [FITNESS_Q],
    external_links: [{ label: "AllTrails: Norvan Falls", url: "https://www.alltrails.com/trail/canada/british-columbia/norvan-falls-trail" }],
    private: { meeting_location: "Lynn Headwaters Park main lot, by the trailhead registration board",
      parking_information: "Free parking at Lynn Headwaters; overflow at Lynn Valley Rd gate (adds 1 km).",
      carpool_details: "Meet-up for carpools at Lonsdale Quay at 8:20." },
    applicants: { confirmed: ["aisha","hannah","lucas"], approved: ["jordan"], submitted: ["marco","ava","ben"], under_review: ["chloe"] },
  },
  {
    key: "hollyburn", slug: "hollyburn-peak-snowshoe", title: "Hollyburn Peak Snowshoe", category: "snowshoeing",
    region: "west-vancouver", status: "published", cover: "/images/scenes/snow-peak.svg",
    summary: "Steady climb through the Nordic area to a summit with ocean and island views.",
    description: "From the Cypress Nordic area we climb the Hollyburn Peak trail to the summit. The final pitch is steep — poles and traction help. Summit views stretch to Vancouver Island on a clear day.",
    dayOffset: 10, start: "08:30", end: "14:00", general_location: "Cypress Provincial Park, West Vancouver",
    distance_km: 7, elevation_gain_m: 450, duration_minutes: 330, difficulty: "moderate", group_pace: "Moderate with regroups",
    required_experience: "beginner", experience_notes: "At least one previous snowshoe or winter hike recommended.",
    fitness_expectations: "Able to climb 450 m on snow over ~2.5 hours.",
    required_equipment: WINTER_GEAR, recommended_equipment: ["Trekking poles with snow baskets", "Goggles"],
    food_water: "Lunch, snacks, hot drink.", transportation: "Winter tires required on Cypress Bowl Road.",
    weather_considerations: "Summit can be windy and cold; we may turn around below the summit in poor visibility.",
    safety_information: "Stay on the marked route. Avalanche terrain is beside the summit — the organizer will direct where to stand.",
    max_participants: 10, registration_deadline_offset_hours: 36, payment_methods: ["none"], waivers: [WINTER_PAGE],
    organizers: ["emma"], questions: [FITNESS_Q],
    external_links: [{ label: "AllTrails: Hollyburn Mountain", url: "https://www.alltrails.com/trail/canada/british-columbia/hollyburn-mountain-trail" }],
    private: { meeting_location: "Cypress Nordic area lodge, by the trail-pass window", parking_information: "Nordic parking lot. A Nordic trail pass is not required for the Hollyburn Peak trail." },
    applicants: { confirmed: ["emma","jordan","ava","lucas","ethan"], submitted: ["hannah","kenji"] },
  },
  {
    key: "burnaby-run", slug: "burnaby-lake-night-trail-run", title: "Burnaby Lake Night Trail Run", category: "trail-running",
    region: "burnaby", status: "published", cover: "/images/scenes/lake-dusk.svg",
    summary: "Headlamps on for a flat, social 10 km loop around Burnaby Lake.",
    description: "A social evening run on the flat Burnaby Lake loop. Two pace groups (6:00 and 7:00 min/km), regroup every 2.5 km. Great for building winter consistency.",
    dayOffset: 5, start: "18:00", end: "19:15", general_location: "Burnaby Lake Regional Park",
    distance_km: 10, elevation_gain_m: 20, duration_minutes: 75, difficulty: "moderate", group_pace: "Two groups: 6:00 and 7:00 min/km",
    required_experience: "beginner", fitness_expectations: "Able to run 10 km continuously at 7:00 min/km.",
    required_equipment: ["Headlamp", "Reflective vest or clothing", "Trail or road running shoes"],
    recommended_equipment: ["Light gloves", "Soft flask"], food_water: "Carry water if you need it; washrooms at the Nature House.",
    transportation: "Sperling–Burnaby Lake SkyTrain is a 10 min jog away.",
    max_participants: 16, payment_methods: ["none"], organizers: ["sofia","ethan"], restrict_logistics: false,
    hidden_fields: ["elevation_gain_m"],
    private: { meeting_location: "Burnaby Lake Sports Complex parking, by the rowing pavilion" },
    applicants: { confirmed: ["ethan","ben","aisha","noah"], submitted: ["chloe"] },
  },
  {
    key: "bootcamp", slug: "kits-beach-sunrise-bootcamp", title: "Kits Beach Sunrise Bootcamp", category: "outdoor-fitness",
    region: "vancouver", status: "published", cover: "/images/scenes/beach-sunrise.svg",
    summary: "A 50-minute bodyweight session by the water. All levels welcome.",
    description: "Wake up with the community: a 50-minute outdoor circuit with modifications for every level, led by a certified trainer in our community. Rain or shine — we have a covered backup spot.",
    dayOffset: 4, start: "07:00", end: "08:00", general_location: "Kitsilano Beach, Vancouver",
    duration_minutes: 60, difficulty: "easy", required_experience: "none",
    fitness_expectations: "Any level — every exercise has an easier option.",
    required_equipment: ["Exercise mat or towel", "Water bottle"], recommended_equipment: ["Layers you can remove"],
    max_participants: 20, price_cents: 1000, payment_methods: ["online","cash"],
    cancellation_policy: "Full refund up to 12 hours before. Late cancellations are not refunded.", cancellation_hours: 12,
    organizers: ["sofia"], restrict_logistics: false,
    private: { meeting_location: "Kits Beach, grass area beside the basketball courts", parking_information: "Pay parking along Cornwall Ave." },
    applicants: { confirmed: ["chloe","zoe","ava","aisha","ben","noah"], approved: ["jordan"] },
  },
  {
    key: "seawall", slug: "stanley-park-pacific-spirit-ride", title: "Seawall to Pacific Spirit Winter Ride", category: "cycling",
    region: "vancouver", status: "published", cover: "/images/scenes/coast-road.svg",
    summary: "A no-drop social ride from the Seawall through Kits to the UBC forest trails.",
    description: "We'll roll the Stanley Park Seawall, cross Burrard Bridge, then head along Point Grey Road to Spanish Banks and a gentle gravel loop in Pacific Spirit Park. Hybrid or gravel bikes recommended.",
    dayOffset: 16, start: "10:00", end: "12:45", general_location: "Stanley Park → Pacific Spirit Park",
    distance_km: 32, elevation_gain_m: 180, duration_minutes: 165, difficulty: "easy", group_pace: "No-drop, ~16 km/h",
    required_experience: "beginner", fitness_expectations: "Comfortable riding 2.5 hours with a short climb to UBC.",
    required_equipment: ["Helmet", "Front and rear lights", "Spare tube or patch kit"],
    recommended_equipment: ["Fenders", "Rain layer"], food_water: "Coffee stop at Jericho Beach.",
    max_participants: 15, payment_methods: ["none"], organizers: ["liam"], restrict_logistics: false,
    private: { meeting_location: "Stanley Park Pavilion lot (near the Rose Garden)" },
    applicants: { confirmed: ["ben","noah","ethan"], submitted: ["marco","jordan"] },
  },
  {
    key: "whistler", slug: "whistler-ski-carpool-day", title: "Whistler Ski & Ride Carpool Day", category: "skiing-snowboarding",
    region: "whistler", status: "published", featured: true, cover: "/images/scenes/alpine-bowl.svg",
    summary: "Shared carpool to Whistler Blackcomb with meetups for lunch and après.",
    description: "Car-share up the Sea-to-Sky for a full day on the hill. Ski or ride in groups by ability, meet for lunch at the Roundhouse and après in the village before driving home together.\n\nThe fee is your share of fuel and parking for the carpool. Lift tickets/passes are your own.",
    dayOffset: 23, start: "06:00", end: "18:30", general_location: "Whistler Blackcomb",
    duration_minutes: 750, difficulty: "moderate", required_experience: "intermediate",
    experience_notes: "Comfortable on blue runs. This is not a lesson.",
    required_equipment: ["Your own lift ticket or Epic Pass", "Helmet", "Ski or snowboard gear"],
    recommended_equipment: ["Goggles for flat light", "Spare gloves", "Change of clothes for après"],
    food_water: "Lunch on the mountain (own cost).", transportation: "Carpool from Vancouver and Coquitlam; drivers reimbursed from fees.",
    weather_considerations: "Highway 99 can close in storms. We'll decide by 8 pm the night before.",
    safety_information: "Ski with a buddy. Know the Alpine Responsibility Code. Out-of-bounds terrain is off-limits for this event.",
    max_participants: 12, reserved_spots: 2, registration_deadline_offset_hours: 72, cancellation_hours: 72,
    price_cents: 2500, payment_methods: ["online","cash"],
    cancellation_policy: "Full refund up to 72 hours before departure. Weather cancellations are fully refunded.",
    organizers: ["liam"], hidden_fields: ["distance_km","elevation_gain_m","group_pace"],
    questions: [{ id: "has_pass", label: "Do you already have a lift ticket or pass for this date?", required: true, type: "yesno" },
                { id: "can_drive", label: "Can you drive (with winter tires)? If so, how many seats?", required: false, type: "text" }],
    private: { meeting_location: "Two pick-ups: Burrard SkyTrain (6:00) and Coquitlam Central park & ride (5:40)",
      carpool_details: "Car assignments posted 48h before departure on the participant page.",
      parking_information: "We park in Day Lots 4–5 in Whistler (included in fee)." },
    applicants: { confirmed: ["noah","emma","marco","ethan","lucas"], approved: ["jordan"], waitlisted: [], submitted: ["aisha","ben"] },
  },
  {
    key: "indian-arm", slug: "indian-arm-winter-paddle", title: "Indian Arm Winter Paddle", category: "kayaking",
    region: "north-vancouver", status: "published", cover: "/images/scenes/fjord-paddle.svg",
    summary: "Glassy winter water, snowy peaks and seals on a guided-pace sea kayak day.",
    description: "Indian Arm is magical in winter: calm water, snow-capped peaks and almost no boat traffic. We'll paddle from Deep Cove to Jug Island and Raccoon Island for lunch on the beach. Rental includes a drysuit, PFD and spray skirt.",
    dayOffset: 17, start: "10:00", end: "14:30", general_location: "Deep Cove → Jug Island",
    distance_km: 12, duration_minutes: 270, difficulty: "moderate", group_pace: "~4 km/h on the water",
    required_experience: "intermediate", experience_notes: "Previous sea-kayak experience and a wet-exit practised in the last two years.",
    fitness_expectations: "Able to paddle 2 hours with short breaks.",
    required_equipment: ["Warm synthetic or wool base layers (no cotton)", "Toque and neoprene gloves", "Dry bag with change of clothes"],
    recommended_equipment: ["Thermos", "Sunglasses with strap"], food_water: "Packed lunch, 1.5 L water, snacks you can eat with gloves on.",
    weather_considerations: "Outflow winds can make the water unsafe; final go/no-go at 7:00 on the day.",
    safety_information: "Drysuits mandatory. Organizer carries a VHF radio, tow belt and first-aid kit. Group stays within 50 m.",
    max_participants: 8, registration_deadline_offset_hours: 168, cancellation_hours: 120, price_cents: 6500,
    payment_methods: ["online"], cancellation_policy: "Rental is non-refundable within 5 days unless we cancel for weather.",
    waivers: [PADDLE_PAGE], organizers: ["daniel"], hidden_fields: ["elevation_gain_m"],
    questions: [{ id: "wet_exit", label: "When did you last practise a wet exit?", required: true, type: "text" },
                { id: "swim", label: "Can you swim 50 m and tread water for 5 minutes?", required: true, type: "yesno" }],
    private: { meeting_location: "Deep Cove Kayak Centre, 2156 Banbury Rd", parking_information: "Paid parking at Panorama Park; allow time." },
    applicants: { confirmed: ["kenji","aisha"], submitted: ["jordan","hannah","zoe"], under_review: ["ben"] },
  },
  {
    key: "social", slug: "port-moody-holiday-social", title: "Holiday Social at Brewers Row", category: "social",
    region: "port-moody", status: "published", featured: true, cover: "/images/scenes/evening-lights.svg",
    summary: "Celebrate the season with the community — meet next year's hiking crew.",
    description: "Our end-of-year get-together on Port Moody's Brewers Row. Non-alcoholic options available, food trucks on site. We'll share a slideshow of the year's trips (consented photos only) and announce winter and spring trips.",
    dayOffset: 19, start: "18:30", end: "21:00", general_location: "Brewers Row, Port Moody",
    duration_minutes: 150, difficulty: "easy", required_experience: "none",
    max_participants: 40, payment_methods: ["none"], organizers: ["maya","sofia"], restrict_logistics: false,
    transportation: "Moody Centre SkyTrain station is a 5 min walk.",
    hidden_fields: ["distance_km","elevation_gain_m","group_pace","required_equipment","recommended_equipment","food_water","weather_considerations"],
    private: { meeting_location: "Patio of Yellow Dog Brewing (reserved under the community name)" },
    applicants: { confirmed: ["jordan","aisha","ethan","hannah","marco","chloe","noah","emma","kenji","ava","lucas","zoe","ben","priya","liam","daniel"], submitted: [] },
  },
  {
    key: "alice", slug: "alice-lake-winter-camping", title: "Alice Lake Winter Car Camping", category: "camping",
    region: "squamish-sea-to-sky", status: "published", cover: "/images/scenes/lake-camp.svg",
    summary: "A cozy winter overnight at Alice Lake with a campfire, hot food and a short morning hike.",
    description: "Car camping with walk-in sites near the lake. We'll share a big pot of chili, stargaze if it's clear and hike the Four Lakes loop in the morning. A great introduction to winter camping with the safety net of your car nearby.",
    dayOffset: 44, start: "13:00", endDayOffset: 45, end: "13:00", general_location: "Alice Lake Provincial Park, Squamish",
    distance_km: 6.5, elevation_gain_m: 150, duration_minutes: 1440, difficulty: "easy", required_experience: "beginner",
    fitness_expectations: "Able to carry your gear 100 m from the car and hike 2 hours.",
    required_equipment: ["Sleeping bag rated to -5°C or colder", "Insulated sleeping pad (R-value 4+)", "Tent (or share — let us know)", "Headlamp", "Warm layers and toque"],
    recommended_equipment: ["Camp chair", "Hot water bottle", "Thermos"], food_water: "Shared dinner and breakfast are included; bring your own lunch and snacks.",
    transportation: "Carpools from Vancouver; Highway 99 winter driving.",
    weather_considerations: "Overnight lows around -5°C. Cancelled if Environment Canada issues a winter storm warning.",
    max_participants: 10, price_cents: 3500, payment_methods: ["online","cash"], cancellation_hours: 120,
    cancellation_policy: "Full refund up to 5 days before. Food costs are non-refundable after that.",
    organizers: ["daniel","hannah"], hidden_fields: ["group_pace"],
    questions: [{ id: "tent", label: "Do you have your own tent? If not, are you happy to share?", required: true, type: "text" },
                { id: "diet", label: "Any dietary needs for the shared meals?", required: false, type: "text" }],
    private: { meeting_location: "Alice Lake Provincial Park, walk-in sites 90–96", parking_information: "Day-use lot B; camping permit covered." },
    applicants: { confirmed: ["hannah","lucas"], submitted: ["marco","zoe","chloe"] },
  },
  {
    key: "harrison", slug: "harrison-hot-springs-weekend", title: "Harrison Hot Springs Weekend Road Trip", category: "road-trips",
    region: "fraser-valley", status: "published", cover: "/images/scenes/valley-road.svg",
    summary: "Two days in the Fraser Valley: Bridal Veil Falls, Harrison lakefront and the hot pools.",
    description: "A relaxed weekend road trip. Saturday: Bridal Veil Falls and a lakeside hike to Sasquatch Provincial Park. Sunday: morning soak and brunch before driving home. Fee covers shared accommodation (two shared cabins) and fuel.\n\nRegistration opens next week — set a reminder!",
    dayOffset: 58, start: "08:00", endDayOffset: 59, end: "18:00", general_location: "Harrison Hot Springs, Fraser Valley",
    distance_km: 12, elevation_gain_m: 300, difficulty: "easy", required_experience: "beginner",
    fitness_expectations: "Two easy-to-moderate hikes of 2–3 hours.",
    required_equipment: ["Hiking shoes", "Rain jacket", "Swimsuit"], recommended_equipment: ["Camera", "Sandals"],
    food_water: "Saturday dinner together (own cost). Accommodation includes a kitchen.",
    transportation: "Shared vehicles from Langley and Vancouver.",
    max_participants: 10, registration_opens_offset_days: 7, price_cents: 12000, deposit_cents: 4000,
    payment_methods: ["online"], cancellation_hours: 336,
    cancellation_policy: "The $40 deposit is non-refundable after approval. The balance is refundable up to 14 days before.",
    organizers: ["liam","maya"],
    private: { meeting_location: "Langley Event Centre park & ride / Joyce-Collingwood Station", parking_information: "Free parking at the cabins." },
    applicants: {},
  },
  {
    key: "seymour", slug: "mount-seymour-first-pump-peak", title: "Mount Seymour First Pump Peak", category: "snowshoeing",
    region: "north-vancouver", status: "postponed", cover: "/images/scenes/snow-peak.svg",
    summary: "Steep snowshoe to First Pump Peak above the ski area.",
    description: "A steady climb beside the Mt Seymour ski runs then into the backcountry to First Pump Peak. Postponed until the snowpack builds.",
    dayOffset: 30, start: "08:00", end: "14:00", general_location: "Mount Seymour Provincial Park",
    distance_km: 8, elevation_gain_m: 450, duration_minutes: 360, difficulty: "challenging", required_experience: "intermediate",
    required_equipment: [...WINTER_GEAR, "Avalanche transceiver, probe and shovel (rentals available)"],
    safety_information: "Route crosses simple avalanche terrain. AST 1 recommended. Organizer checks avalanche.ca forecast.",
    max_participants: 8, payment_methods: ["none"], waivers: [WINTER_PAGE], organizers: ["priya"],
    status_note: "Postponed: not enough snow coverage yet. Applications stay active; we'll confirm a new date soon.",
    private: { meeting_location: "Mt Seymour P1 lot" },
    applicants: { approved: ["emma","lucas"], submitted: ["ethan"] },
  },
  {
    key: "cypress-sunset", slug: "cypress-sunset-snowshoe", title: "Cypress Sunset Snowshoe", category: "snowshoeing",
    region: "west-vancouver", status: "cancelled", cover: "/images/scenes/sunrise-ridge.svg",
    summary: "Sunset snowshoe to Bowen Lookout.", weather_cancellation: true,
    description: "A short snowshoe timed for sunset at Bowen Lookout.",
    dayOffset: 1, start: "15:30", end: "18:30", general_location: "Cypress Provincial Park",
    distance_km: 4, elevation_gain_m: 120, duration_minutes: 180, difficulty: "easy", required_experience: "none",
    max_participants: 12, payment_methods: ["none"], organizers: ["emma"],
    status_note: "Cancelled due to a wind warning on Cypress. Sorry — we'll reschedule in January.",
    private: { meeting_location: "Cypress downhill lot" },
    applicants: {},
  },
  {
    key: "gold-creek", slug: "golden-ears-gold-creek-falls", title: "Golden Ears: Lower Falls & Viewpoint Beach", category: "hiking",
    region: "maple-ridge", status: "draft", cover: "/images/scenes/forest-falls.svg",
    summary: "Draft: forest walk to Lower Falls with an optional extension to Viewpoint Beach.",
    description: "Draft event created from a member suggestion.",
    dayOffset: 37, start: "09:30", end: "14:00", general_location: "Golden Ears Provincial Park",
    distance_km: 9, elevation_gain_m: 120, duration_minutes: 240, difficulty: "easy", required_experience: "none",
    max_participants: 14, payment_methods: ["none"], organizers: ["priya"],
    private: { meeting_location: "Gold Creek parking lot" }, applicants: {},
  },
  // ---- Past activities ----
  {
    key: "lighthouse", slug: "lighthouse-park-coastal-loop", title: "Lighthouse Park Coastal Loop", category: "hiking",
    region: "west-vancouver", status: "completed", cover: "/images/scenes/coast-road.svg",
    summary: "Old-growth forest and granite bluffs above Point Atkinson.", description: "Easy forest loop with ocean bluffs.",
    dayOffset: -26, start: "10:00", end: "13:00", general_location: "Lighthouse Park, West Vancouver",
    distance_km: 6, elevation_gain_m: 180, duration_minutes: 180, difficulty: "easy", required_experience: "none",
    max_participants: 12, payment_methods: ["none"], organizers: ["priya"],
    private: { meeting_location: "Lighthouse Park lot" },
    applicants: { attended: ["jordan","aisha","hannah","chloe","ava","zoe","ben","kenji","marco","priya"], no_show: ["olivia"] },
  },
  {
    key: "buntzen", slug: "buntzen-lake-loop", title: "Buntzen Lake Autumn Loop", category: "hiking",
    region: "port-moody", status: "completed", cover: "/images/scenes/lake-dusk.svg",
    summary: "Golden larches? No — but plenty of golden maples around Buntzen Lake.", description: "Full lake loop.",
    dayOffset: -40, start: "09:00", end: "14:00", general_location: "Buntzen Lake, Anmore",
    distance_km: 11, elevation_gain_m: 250, duration_minutes: 300, difficulty: "moderate", required_experience: "beginner",
    max_participants: 14, payment_methods: ["none"], organizers: ["sofia"],
    private: { meeting_location: "Buntzen Lake South Beach lot" },
    applicants: { attended: ["jordan","aisha","ethan","hannah","marco","ava","lucas","zoe","ben","kenji","emma","sofia"] },
  },
  {
    key: "deepcove-kayak", slug: "deep-cove-sunset-kayak", title: "Deep Cove Sunset Kayak", category: "kayaking",
    region: "north-vancouver", status: "completed", cover: "/images/scenes/fjord-paddle.svg",
    summary: "Evening paddle to Belcarra with seals for company.", description: "Sunset paddle.",
    dayOffset: -68, start: "17:30", end: "20:30", general_location: "Deep Cove", distance_km: 8, duration_minutes: 180,
    difficulty: "easy", required_experience: "beginner", max_participants: 8, price_cents: 5500, payment_methods: ["online"],
    waivers: [PADDLE_PAGE], organizers: ["daniel"], hidden_fields: ["elevation_gain_m"],
    private: { meeting_location: "Deep Cove Kayak Centre" },
    applicants: { attended: ["aisha","kenji","zoe","hannah","jordan","chloe","daniel"] },
  },
  {
    key: "garibaldi", slug: "garibaldi-lake-overnight", title: "Garibaldi Lake Overnight Backpack", category: "backpacking",
    region: "squamish-sea-to-sky", status: "completed", cover: "/images/scenes/alpine-lake.svg",
    summary: "The turquoise lake that started it all.", description: "Two-day backpacking trip.",
    dayOffset: -96, start: "07:00", endDayOffset: -95, end: "16:00", general_location: "Garibaldi Provincial Park",
    distance_km: 18, elevation_gain_m: 820, duration_minutes: 2000, difficulty: "challenging", required_experience: "intermediate",
    max_participants: 8, price_cents: 2000, payment_methods: ["online","cash"], organizers: ["maya"],
    private: { meeting_location: "Rubble Creek parking lot" },
    applicants: { attended: ["lucas","marco","ethan","emma","hannah","jordan","maya"] },
  },
  {
    key: "jericho", slug: "jericho-sunset-sup", title: "Jericho Beach Sunset SUP", category: "paddleboarding",
    region: "vancouver", status: "completed", cover: "/images/scenes/beach-sunrise.svg",
    summary: "Golden-hour paddle along Jericho and Locarno.", description: "Sunset SUP.",
    dayOffset: -131, start: "19:00", end: "21:00", general_location: "Jericho Beach", distance_km: 4, duration_minutes: 120,
    difficulty: "easy", required_experience: "none", max_participants: 12, price_cents: 3000, payment_methods: ["online"],
    waivers: [PADDLE_PAGE], organizers: ["daniel"], hidden_fields: ["elevation_gain_m"],
    private: { meeting_location: "Jericho Sailing Centre" },
    applicants: { attended: ["aisha","zoe","chloe","ava","ben","kenji","jordan","daniel"] },
  },
];

export const highlights = [
  { key: "h1", event: "garibaldi", title: "Garibaldi Lake at golden hour", caption: "Eight of us, one very turquoise lake.", image: "/images/scenes/alpine-lake.svg" },
  { key: "h2", event: "buntzen", title: "Buntzen Lake loop", caption: "Twelve members, zero rain (a miracle).", image: "/images/scenes/lake-dusk.svg" },
  { key: "h3", event: "jericho", title: "Sunset SUP at Jericho", caption: "Calm water and a perfect sunset.", image: "/images/scenes/beach-sunrise.svg" },
  { key: "h4", event: "deepcove-kayak", title: "Seals off Belcarra", caption: "Deep Cove sunset paddle.", image: "/images/scenes/fjord-paddle.svg" },
];

export const suggestions = [
  { key: "s1", by: "marco", name: "Panorama Ridge (summer)", location: "Garibaldi Provincial Park", category: "hiking",
    timing: "July–August", difficulty: "strenuous" as Difficulty, link: "https://www.alltrails.com/trail/canada/british-columbia/panorama-ridge",
    explanation: "Big day, but the view over Garibaldi Lake is the best in the Lower Mainland. Could be an overnight from Taylor Meadows.", help: true,
    votes: ["lucas","emma","ethan","hannah","jordan","priya"] },
  { key: "s2", by: "zoe", name: "Sasamat Lake SUP & picnic", location: "Belcarra Regional Park", category: "paddleboarding",
    timing: "June", difficulty: "easy" as Difficulty, explanation: "Warm water, easy beginner paddle, picnic after.", help: true,
    votes: ["aisha","chloe","ava"] },
  { key: "s3", by: "ben", name: "Fraser Valley gravel ride", location: "Abbotsford / Chilliwack", category: "cycling",
    timing: "Spring", difficulty: "moderate" as Difficulty, explanation: "Quiet farm roads and a bakery stop.", help: false,
    votes: ["noah"] },
  { key: "s4", by: "hannah", name: "Golden Ears Lower Falls", location: "Golden Ears Provincial Park", category: "hiking",
    timing: "Winter", difficulty: "easy" as Difficulty, explanation: "Easy, beautiful in winter, good for newer members.", help: false,
    votes: ["chloe","kenji"], converted: "gold-creek" },
];
