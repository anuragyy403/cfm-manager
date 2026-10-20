import { AppShell, type NavItem } from "@/components/app-shell";
import { requireHR } from "@/server/session";

const nav: NavItem[] = [
  { href: "/hr", label: "Overview", shortLabel: "Home", icon: "overview", exact: true },
  { href: "/hr/my-tasks", label: "My tasks", shortLabel: "Mine", icon: "myTasks" },
  { href: "/hr/tasks", label: "All tasks", shortLabel: "Tasks", icon: "tasks" },
  { href: "/hr/teams", label: "Teams", icon: "team" },
  { href: "/hr/analytics", label: "Analytics", shortLabel: "Stats", icon: "analytics" },
];

/** HR's workspace: every team's work, plus the work the owner gives HR. */
export default async function HRLayout({ children }: LayoutProps<"/hr">) {
  const user = await requireHR();
  return (
    <AppShell nav={nav} user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>
      {children}
    </AppShell>
  );
}
