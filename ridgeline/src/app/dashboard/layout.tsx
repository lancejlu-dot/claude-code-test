import { requireViewer } from "@/lib/auth";
import { SideNav } from "@/components/side-nav";
import { MemberStatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "layout" },
  { href: "/dashboard/activities", label: "My activities", icon: "calendar" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/payments", label: "Payments", icon: "card" },
  { href: "/dashboard/standing", label: "Account standing", icon: "shield" },
  { href: "/dashboard/profile", label: "Profile", icon: "user" },
  { href: "/dashboard/account", label: "Privacy & account", icon: "settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-[230px_1fr] lg:py-12">
      <div>
        <div className="mb-4 hidden lg:block">
          <p className="font-display text-xl text-forest-950">{v.firstName} {v.lastInitial}.</p>
          <div className="mt-1"><MemberStatusBadge status={v.status} /></div>
        </div>
        <SideNav items={NAV.map((n) => (n.href === "/dashboard/notifications" && v.unread ? { ...n, badge: v.unread } : n))} label="Dashboard" />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
