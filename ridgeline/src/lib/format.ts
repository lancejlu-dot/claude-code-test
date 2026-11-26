import type {
  ApplicationStatus, AttendanceOutcome, Difficulty, ExperienceLevel, MemberStatus, PaymentStatus, PublicStatus,
} from "./types";

export const TZ = "America/Vancouver";

const fmt = (opts: Intl.DateTimeFormatOptions, tz = TZ) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts });

export const formatDate = (iso: string, tz = TZ) => fmt({ weekday: "short", month: "short", day: "numeric" }, tz).format(new Date(iso));
export const formatDateLong = (iso: string, tz = TZ) =>
  fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" }, tz).format(new Date(iso));
export const formatTime = (iso: string, tz = TZ) =>
  fmt({ hour: "numeric", minute: "2-digit", hour12: true }, tz).format(new Date(iso)).replace(/\s?([ap])\.?m\.?/i, (_, x) => ` ${x.toUpperCase()}M`);
export const formatDateTime = (iso: string, tz = TZ) => `${formatDate(iso, tz)} · ${formatTime(iso, tz)}`;
export const formatMonthYear = (iso: string, tz = TZ) => fmt({ month: "long", year: "numeric" }, tz).format(new Date(iso));

/** YYYY-MM-DD in the community time zone. */
export const localDay = (iso: string | Date, tz = TZ) => fmt({ year: "numeric", month: "2-digit", day: "2-digit" }, tz).format(new Date(iso));

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return null;
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export function formatMoney(cents: number, currency = "CAD") {
  if (!cents) return "Free";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export function relativeFromNow(iso: string) {
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86400_000) return rtf.format(Math.round(diff / 3600_000), "hour");
  return rtf.format(Math.round(diff / 86400_000), "day");
}

export function membershipDuration(sinceIso: string) {
  const months = Math.max(0, Math.floor((Date.now() - Date.parse(sinceIso)) / (30.44 * 86400_000)));
  if (months < 1) return "New member";
  if (months < 12) return `Member for ${months} month${months > 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  return `Member for ${years} year${years > 1 ? "s" : ""}`;
}

export const difficultyLabel: Record<Difficulty, string> = {
  easy: "Easy", moderate: "Moderate", challenging: "Challenging", strenuous: "Strenuous", expert: "Expert",
};
export const difficultyRank: Record<Difficulty, number> = { easy: 1, moderate: 2, challenging: 3, strenuous: 4, expert: 5 };

export const experienceLabel: Record<ExperienceLevel, string> = {
  none: "No experience needed", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert",
};

export const publicStatusLabel: Record<PublicStatus, string> = {
  draft: "Draft", open: "Open for applications", waitlist: "Full · Waitlist open", full: "Full", closed: "Applications closed",
  completed: "Completed", cancelled: "Cancelled", postponed: "Postponed", upcoming: "Opens soon",
};

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  submitted: "Application submitted", under_review: "Under review", approved: "Approved — action needed",
  awaiting_confirmation: "Offer — awaiting your reply", confirmed: "Confirmed", waitlisted: "Waitlisted",
  not_selected: "Not selected", cancelled: "Cancelled", attended: "Attended", no_show: "No-show",
};

export const attendanceLabel: Record<AttendanceOutcome, string> = {
  attended: "Attended", cancelled_in_period: "Cancelled in time", late_cancellation: "Late cancellation",
  excused_absence: "Excused absence", unexcused_no_show: "Unexcused no-show", event_cancelled: "Event cancelled",
};

export const memberStatusLabel: Record<MemberStatus, string> = {
  pending: "Pending approval", active: "Active", restricted: "Restricted", suspended: "Suspended", removed: "Removed", rejected: "Not approved",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Outstanding", paid: "Paid", refunded: "Refunded", partially_refunded: "Partially refunded", waived: "Waived", failed: "Failed",
};

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
