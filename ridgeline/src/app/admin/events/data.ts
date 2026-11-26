import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getRegions } from "@/lib/data/public";

export async function getEventFormData(isAdmin: boolean) {
  const sb = await createClient();
  const [categories, regions, { data: waivers }, staff] = await Promise.all([
    getCategories(), getRegions(),
    sb.from("waiver_templates").select("id,title,kind").eq("active", true).order("title"),
    isAdmin ? sb.from("staff_roles").select("user_id,profiles!staff_roles_user_id_fkey(first_name,last_initial)").in("role", ["organizer", "admin", "owner"]) : Promise.resolve({ data: null }),
  ]);
  const staffList = staff.data
    ? [...new Map((staff.data as unknown as { user_id: string; profiles: { first_name: string; last_initial: string } }[])
        .map((s) => [s.user_id, { id: s.user_id, name: `${s.profiles.first_name} ${s.profiles.last_initial}.` }])).values()]
    : undefined;
  return { categories, regions, waiverTemplates: waivers ?? [], staff: staffList };
}
