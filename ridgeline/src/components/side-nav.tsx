"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, BarChart3, CalendarDays, ClipboardList, CreditCard, FileSignature, History, Inbox, LayoutDashboard, Lightbulb, Megaphone,
  Settings, ShieldAlert, ShieldCheck, Siren, User, Users, FileText, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/format";

const ICONS: Record<string, LucideIcon> = {
  layout: LayoutDashboard, calendar: CalendarDays, bell: Bell, card: CreditCard, shield: ShieldCheck, user: User, settings: Settings,
  users: Users, list: ClipboardList, waiver: FileSignature, megaphone: Megaphone, bulb: Lightbulb, alert: ShieldAlert, siren: Siren,
  history: History, chart: BarChart3, inbox: Inbox, file: FileText,
};

export interface NavItem { href: string; label: string; icon: string; badge?: number }

export function SideNav({ items, label }: { items: NavItem[]; label: string }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href.split("/").length > 2 && path.startsWith(href + "/"));
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((it) => {
          const Icon = ICONS[it.icon] ?? LayoutDashboard;
          const active = isActive(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                  active ? "bg-forest-800 text-white" : "text-forest-900 hover:bg-forest-900/5")}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />{it.label}
                {it.badge ? <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-bold", active ? "bg-white/20" : "bg-ember-500 text-white")}>{it.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
