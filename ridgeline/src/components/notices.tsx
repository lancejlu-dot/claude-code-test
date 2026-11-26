import Link from "next/link";
import { Info, Scale, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function DemoBanner() {
  return (
    <div className="bg-ember-500 text-white">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-2 py-1.5 text-center text-xs font-medium sm:text-[13px]">
        <span>Demo data — fictional people and activities, not a live community.</span>
        <Link href="/demo" className="underline underline-offset-2">How to connect a real database</Link>
      </div>
    </div>
  );
}

export function LegalReviewNotice({ what = "This document" }: { what?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-ember-100/70 p-4 text-sm text-ember-700 ring-1 ring-ember-600/20">
      <Scale className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p><strong>Draft — requires legal review.</strong> {what} is a starting template and must be reviewed by a qualified British Columbia lawyer before production use.</p>
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn"; title?: string; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 text-sm ring-1 ${tone === "warn" ? "bg-ember-100/60 text-ember-700 ring-ember-600/20" : "bg-lake-100/60 text-lake-700 ring-lake-600/20"}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>{title && <p className="font-semibold">{title}</p>}<div className={title ? "mt-0.5" : ""}>{children}</div></div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl text-forest-950 sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <p className="font-display text-xl text-forest-950">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
