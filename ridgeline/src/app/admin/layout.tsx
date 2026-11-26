import { requireStaff } from "@/lib/auth";
import { SideNav, type NavItem } from "@/components/side-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await requireStaff();
  const items: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "chart" },
    { href: "/admin/events", label: "Events", icon: "calendar" },
    ...(v.isAdmin ? [
      { href: "/admin/members", label: "Members", icon: "users" },
      { href: "/admin/appeals", label: "Appeals", icon: "shield" },
      { href: "/admin/payments", label: "Payments", icon: "card" },
      { href: "/admin/waivers", label: "Waivers", icon: "waiver" },
    ] : []),
    { href: "/admin/announcements", label: "Announcements", icon: "megaphone" },
    ...(v.isAdmin ? [{ href: "/admin/suggestions", label: "Suggestions", icon: "bulb" }] : []),
    ...(v.isModerator ? [{ href: "/admin/moderation", label: "Moderation", icon: "alert" }] : []),
    { href: "/admin/incidents", label: "Incidents", icon: "siren" },
    ...(v.isAdmin ? [
      { href: "/admin/content", label: "Content & FAQ", icon: "file" },
      { href: "/admin/audit", label: "Audit log", icon: "history" },
    ] : []),
    ...(v.isOwner ? [{ href: "/admin/settings", label: "Settings", icon: "settings" }] : []),
  ];
  return (
    <div className="bg-white/40">
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <div>
          <p className="mb-3 hidden text-xs font-semibold tracking-widest text-muted uppercase lg:block">Admin · {v.roles.join(", ")}</p>
          <SideNav items={items} label="Admin" />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
