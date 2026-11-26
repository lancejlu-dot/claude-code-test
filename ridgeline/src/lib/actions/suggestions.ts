"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { bool, dbError, guardDemo, optStr, str } from "./helpers";
import type { ActionResult } from "@/components/forms";

export async function submitSuggestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const blocked = guardDemo(); if (blocked) return blocked;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const name = str(fd, "name");
  if (name.length < 3) return { ok: false, error: "Give the activity a name." };
  const link = optStr(fd, "external_link");
  if (link && !/^https?:\/\//.test(link)) return { ok: false, error: "Links must start with http:// or https://" };
  const { error } = await sb.from("suggestions").insert({
    user_id: c?.claims?.sub, name, location: optStr(fd, "location"), category_id: optStr(fd, "category_id"),
    preferred_timing: optStr(fd, "preferred_timing"), difficulty: optStr(fd, "difficulty"), external_link: link,
    explanation: optStr(fd, "explanation"), willing_to_help: bool(fd, "willing_to_help"),
  });
  if (error) return dbError(error, "Only active members can suggest activities.");
  revalidatePath("/suggestions");
  return { ok: true, message: "Thanks! Your suggestion is live for other members to vote on." };
}

export async function toggleVote(fd: FormData) {
  if (guardDemo()) return;
  const sb = await createClient();
  const { data: c } = await sb.auth.getClaims();
  const id = str(fd, "suggestion_id");
  if (str(fd, "voted") === "true") await sb.from("suggestion_votes").delete().eq("suggestion_id", id).eq("user_id", c?.claims?.sub as string);
  else await sb.from("suggestion_votes").insert({ suggestion_id: id, user_id: c?.claims?.sub });
  revalidatePath("/suggestions");
}
