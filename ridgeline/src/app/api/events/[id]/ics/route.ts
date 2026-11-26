import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getBrand } from "@/lib/data/public";
import { buildIcs } from "@/lib/ics";
import { siteUrl } from "@/lib/env";

// Calendar file for confirmed participants (exact meeting point included when visible to them).
export async function GET(_: Request, ctx: RouteContext<"/api/events/[id]/ics">) {
  const { id } = await ctx.params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const sb = await createClient();
  const [{ data: e }, { data: app }, { data: priv }, brand] = await Promise.all([
    sb.from("events").select("id,slug,title,starts_at,ends_at,general_location,summary").eq("id", id).maybeSingle(),
    sb.from("applications").select("status").eq("event_id", id).eq("user_id", viewer.id).maybeSingle(),
    sb.from("event_private_details").select("meeting_location").eq("event_id", id).maybeSingle(),
    getBrand(),
  ]);
  if (!e || !app || !["confirmed", "approved"].includes(app.status)) return NextResponse.json({ error: "Only selected participants can download this" }, { status: 403 });
  const ics = buildIcs({ id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, location: priv?.meeting_location ?? e.general_location,
    description: e.summary, url: `${siteUrl}/activities/${e.slug}/hub`, brand: brand.name });
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${e.slug}.ics"` } });
}
