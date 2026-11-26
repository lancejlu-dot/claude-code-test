"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { dbError, guardDemo, num, str } from "./helpers";
import type { ActionResult } from "@/components/forms";

async function uid() {
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  return { sb, uid: data?.claims?.sub as string };
}

export async function postMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const body = str(fd, "body");
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > 4000) return { ok: false, error: "Messages are limited to 4,000 characters." };
  const { sb, uid: me } = await uid();
  const { error } = await sb.from("event_posts").insert({ event_id: str(fd, "event_id"), author_id: me, body, is_announcement: fd.get("announcement") === "on" });
  if (error) return dbError(error, "You can post once you're a confirmed participant.");
  revalidatePath(str(fd, "path") || "/");
  return { ok: true, message: "Posted." };
}

export async function deletePost(fd: FormData) {
  if (guardDemo()) return;
  const { sb } = await uid();
  await sb.from("event_posts").delete().eq("id", str(fd, "post_id"));
  revalidatePath(str(fd, "path") || "/");
}

export async function moderatePost(fd: FormData) {
  if (guardDemo()) return;
  const { sb } = await uid();
  await sb.rpc("moderate_post", { p_post: str(fd, "post_id"), p_hidden: str(fd, "hidden") === "true", p_reason: str(fd, "reason") || null });
  revalidatePath(str(fd, "path") || "/");
}

export async function pinPost(fd: FormData) {
  if (guardDemo()) return;
  const { sb } = await uid();
  await sb.rpc("pin_post", { p_post: str(fd, "post_id"), p_pinned: str(fd, "pinned") === "true" });
  revalidatePath(str(fd, "path") || "/");
}

export async function offerCarpool(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const { sb, uid: me } = await uid();
  const seats = num(fd, "seats");
  if (!seats || seats < 1 || seats > 8) return { ok: false, error: "Offer between 1 and 8 seats." };
  const area = str(fd, "departure_area");
  if (!area) return { ok: false, error: "Add a general departure area (no home addresses, please)." };
  const { error } = await sb.from("carpool_offers").upsert({
    event_id: str(fd, "event_id"), driver_id: me, seats, departure_area: area,
    departure_time_note: str(fd, "departure_time_note") || null, notes: str(fd, "notes") || null,
  }, { onConflict: "event_id,driver_id" });
  if (error) return dbError(error, "Only confirmed participants can offer carpools.");
  revalidatePath(str(fd, "path") || "/");
  return { ok: true, message: "Carpool offer posted." };
}

export async function joinCarpool(fd: FormData) {
  if (guardDemo()) return;
  const { sb, uid: me } = await uid();
  await sb.from("carpool_riders").insert({ offer_id: str(fd, "offer_id"), rider_id: me });
  revalidatePath(str(fd, "path") || "/");
}

export async function leaveCarpool(fd: FormData) {
  if (guardDemo()) return;
  const { sb, uid: me } = await uid();
  const rider = str(fd, "rider_id") || me;
  await sb.from("carpool_riders").delete().eq("offer_id", str(fd, "offer_id")).eq("rider_id", rider);
  revalidatePath(str(fd, "path") || "/");
}

export async function removeCarpoolOffer(fd: FormData) {
  if (guardDemo()) return;
  const { sb } = await uid();
  await sb.from("carpool_offers").delete().eq("id", str(fd, "offer_id"));
  revalidatePath(str(fd, "path") || "/");
}
