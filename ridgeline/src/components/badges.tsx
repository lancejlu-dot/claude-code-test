import {
  applicationStatusLabel, cn, difficultyLabel, memberStatusLabel, paymentStatusLabel, publicStatusLabel,
} from "@/lib/format";
import type { ApplicationStatus, Difficulty, MemberStatus, PaymentStatus, PublicStatus } from "@/lib/types";

const PUBLIC: Record<PublicStatus, string> = {
  open: "bg-forest-700 text-white", waitlist: "bg-ember-500 text-white", full: "bg-ink text-white",
  closed: "bg-sand-300 text-forest-950", completed: "bg-white/90 text-forest-900 ring-1 ring-forest-900/10",
  cancelled: "bg-ember-700 text-white", postponed: "bg-lake-600 text-white", upcoming: "bg-lake-100 text-lake-700",
  draft: "bg-sand-200 text-muted",
};

export function EventStatusBadge({ status, className }: { status: PublicStatus; className?: string }) {
  return <span className={cn("chip shadow-sm", PUBLIC[status], className)}>{publicStatusLabel[status]}</span>;
}

const DIFF: Record<Difficulty, string> = {
  easy: "bg-moss-100 text-forest-800", moderate: "bg-lake-100 text-lake-700", challenging: "bg-ember-100 text-ember-700",
  strenuous: "bg-ember-600 text-white", expert: "bg-ink text-white",
};
const DOTS: Record<Difficulty, number> = { easy: 1, moderate: 2, challenging: 3, strenuous: 4, expert: 5 };

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty | null }) {
  if (!difficulty) return null;
  return (
    <span className={cn("chip", DIFF[difficulty])} title={`Difficulty: ${difficultyLabel[difficulty]}`}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= DOTS[difficulty] ? "bg-current" : "bg-current/25")} />)}
      </span>
      {difficultyLabel[difficulty]}
    </span>
  );
}

const APP: Record<ApplicationStatus, string> = {
  submitted: "bg-sand-200 text-forest-900", under_review: "bg-lake-100 text-lake-700", approved: "bg-ember-100 text-ember-700",
  awaiting_confirmation: "bg-ember-500 text-white", confirmed: "bg-forest-700 text-white", waitlisted: "bg-sand-300 text-forest-950",
  not_selected: "bg-sand-100 text-muted", cancelled: "bg-sand-100 text-muted", attended: "bg-moss-100 text-forest-800",
  no_show: "bg-ember-700 text-white",
};
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={cn("chip", APP[status])}>{applicationStatusLabel[status]}</span>;
}

const MEM: Record<MemberStatus, string> = {
  pending: "bg-lake-100 text-lake-700", active: "bg-moss-100 text-forest-800", restricted: "bg-ember-100 text-ember-700",
  suspended: "bg-ember-600 text-white", removed: "bg-ink text-white", rejected: "bg-sand-200 text-muted",
};
export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return <span className={cn("chip", MEM[status])}>{memberStatusLabel[status]}</span>;
}

const PAY: Record<PaymentStatus, string> = {
  pending: "bg-ember-100 text-ember-700", paid: "bg-moss-100 text-forest-800", refunded: "bg-sand-200 text-muted",
  partially_refunded: "bg-sand-200 text-forest-900", waived: "bg-lake-100 text-lake-700", failed: "bg-sand-100 text-muted",
};
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={cn("chip", PAY[status])}>{paymentStatusLabel[status]}</span>;
}
