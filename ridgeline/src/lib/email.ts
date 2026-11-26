import "server-only";
import { isEmailConfigured } from "./env";

/**
 * Sends one transactional email through Resend's HTTP API.
 * Returns { skipped: true } when no provider is configured — callers record that honestly.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<{ id?: string; skipped?: boolean; error?: string }> {
  if (!isEmailConfigured()) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 300)}` };
  const json = (await res.json()) as { id?: string };
  return { id: json.id };
}
