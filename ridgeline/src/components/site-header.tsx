import Link from "next/link";
import { Bell, Mountain } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getBrand } from "@/lib/data/public";
import { isDemoMode } from "@/lib/env";
import { MobileMenu } from "./mobile-menu";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/activities", label: "Activities" },
  { href: "/activities?view=calendar", label: "Calendar" },
  { href: "/faq", label: "How it works" },
  { href: "/policies/community-guidelines", label: "Guidelines" },
];

export async function SiteHeader() {
  const [viewer, brand] = await Promise.all([getViewer(), getBrand()]);
  return (
    <header className="sticky top-0 z-40 border-b border-forest-900/5 bg-sand-50/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-forest-900" aria-label={`${brand.name} home`}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-forest-800 text-white"><Mountain className="h-5 w-5" aria-hidden /></span>
          <span className="font-display text-lg font-semibold tracking-tight">{brand.name}</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 text-sm font-medium text-forest-900/80 hover:bg-forest-900/5 hover:text-forest-950">{n.label}</Link>)}
          {viewer && <Link href="/suggestions" className="rounded-full px-3 py-2 text-sm font-medium text-forest-900/80 hover:bg-forest-900/5">Suggest</Link>}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {viewer ? (
            <>
              {viewer.isStaff && <Link href="/admin" className="btn-ghost btn-sm">Admin</Link>}
              <Link href="/dashboard/notifications" className="relative rounded-full p-2 text-forest-900 hover:bg-forest-900/5" aria-label={`Notifications${viewer.unread ? `, ${viewer.unread} unread` : ""}`}>
                <Bell className="h-5 w-5" aria-hidden />
                {viewer.unread > 0 && <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white">{viewer.unread > 9 ? "9+" : viewer.unread}</span>}
              </Link>
              <Link href="/dashboard" className="btn-secondary btn-sm">{viewer.firstName}&apos;s dashboard</Link>
              <form action={signOut}><button className="btn-ghost btn-sm" type="submit">Sign out</button></form>
            </>
          ) : isDemoMode ? (
            <Link href="/demo" className="btn-primary btn-sm">About this demo</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
              <Link href="/signup" className="btn-primary btn-sm">Join the community</Link>
            </>
          )}
        </div>
        <MobileMenu nav={NAV} signedIn={Boolean(viewer)} isStaff={Boolean(viewer?.isStaff)} demo={isDemoMode} unread={viewer?.unread ?? 0} />
      </div>
    </header>
  );
}
