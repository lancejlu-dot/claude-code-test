// Registry of optional event fields. Admins can hide any of these per event;
// each category supplies sensible defaults (activity_categories.hidden_fields).

export interface FieldDef {
  key: string;
  label: string;
  group: "basics" | "route" | "requirements" | "logistics" | "safety" | "pricing";
}

export const HIDEABLE_FIELDS: FieldDef[] = [
  { key: "distance_km", label: "Distance", group: "route" },
  { key: "elevation_gain_m", label: "Elevation gain", group: "route" },
  { key: "duration_minutes", label: "Estimated duration", group: "route" },
  { key: "difficulty", label: "Difficulty rating", group: "route" },
  { key: "group_pace", label: "Expected group pace", group: "route" },
  { key: "required_experience", label: "Required experience", group: "requirements" },
  { key: "fitness_expectations", label: "Minimum fitness expectations", group: "requirements" },
  { key: "required_equipment", label: "Required equipment", group: "requirements" },
  { key: "recommended_equipment", label: "Recommended equipment", group: "requirements" },
  { key: "food_water", label: "Food & water", group: "requirements" },
  { key: "transportation", label: "Transportation & carpooling", group: "logistics" },
  { key: "parking_information", label: "Parking information", group: "logistics" },
  { key: "weather_considerations", label: "Weather considerations", group: "safety" },
  { key: "safety_information", label: "Safety information", group: "safety" },
  { key: "cancellation_policy", label: "Cancellation policy", group: "pricing" },
];

export const isVisible = (hidden: string[] | null | undefined, key: string) => !(hidden ?? []).includes(key);
