import { AppShell, type NavItem } from "@/components/app-shell";
import { requireOwner } from "@/server/session";

const nav: NavItem[] = [
  { href: "/admin", label: "Overview", shortLabel: "Home", icon: "overview", exact: true },
  { href: "/admin/tasks", label: "Tasks", icon: "tasks" },
  { href: "/admin/teams", label: "Teams", icon: "team" },
  { href: "/admin/people", label: "People", icon: "people" },
  { href: "/admin/analytics", label: "Analytics", shortLabel: "Stats", icon: "analytics" },
];

/** The owner's workspace: every team, manager, employee and task. */
export default async function OwnerLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireOwner();
  return (
    <AppShell nav={nav} user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>
      {children}
    </AppShell>
  );
}
