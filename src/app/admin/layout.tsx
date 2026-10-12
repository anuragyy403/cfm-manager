import { AppShell, type NavItem } from "@/components/app-shell";
import { requireAdmin } from "@/server/session";

const nav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/tasks", label: "Tasks", icon: "tasks" },
  { href: "/admin/team", label: "Team", icon: "team" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <AppShell nav={nav} user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </AppShell>
  );
}
