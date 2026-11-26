import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!isDemoMode) {
    const sb = await createClient();
    await sb.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
