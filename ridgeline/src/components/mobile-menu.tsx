"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export function MobileMenu({ nav, signedIn, isStaff, demo, unread }:
  { nav: { href: string; label: string }[]; signedIn: boolean; isStaff: boolean; demo: boolean; unread: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  const links = [
    ...nav,
    ...(signedIn ? [{ href: "/dashboard", label: "My dashboard" }, { href: "/dashboard/notifications", label: `Notifications${unread ? ` (${unread})` : ""}` }, { href: "/suggestions", label: "Suggest an activity" }] : []),
    ...(isStaff ? [{ href: "/admin", label: "Admin portal" }] : []),
  ];
  return (
    <div className="md:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav"
        className="rounded-full p-2 text-forest-900 hover:bg-forest-900/5" aria-label={open ? "Close menu" : "Open menu"}>
        {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
      </button>
      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto bg-sand-50 px-4 pt-4 pb-10">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-forest-900/5 py-4 font-display text-xl text-forest-950">{l.label}</Link>)}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            {signedIn ? (
              <form action="/auth/signout" method="post"><button className="btn-secondary w-full" type="submit">Sign out</button></form>
            ) : demo ? (
              <Link href="/demo" className="btn-primary">About this demo</Link>
            ) : (
              <><Link href="/signup" className="btn-primary">Join the community</Link><Link href="/login" className="btn-secondary">Sign in</Link></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
