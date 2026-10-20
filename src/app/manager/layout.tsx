import { AppShell, type NavItem } from "@/components/app-shell";
import { requireManager } from "@/server/session";

const nav: NavItem[] = [
  { href: "/manager", label: "Overview", shortLabel: "Home", icon: "overview", exact: true },
  { href: "/manager/my-tasks", label: "My tasks", shortLabel: "Mine", icon: "myTasks" },
  { href: "/manager/tasks", label: "Team tasks", shortLabel: "Tasks", icon: "tasks" },
  { href: "/manager/teams", label: "Teams", icon: "team" },
  { href: "/manager/analytics", label: "Analytics", shortLabel: "Stats", icon: "analytics" },
];

/** A manager's workspace: their own work from the owner, plus the teams they run. */
export default async function ManagerLayout({ children }: LayoutProps<"/manager">) {
  const user = await requireManager();
  return (
    <AppShell nav={nav} user={{ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role }}>
      {children}
    </AppShell>
  );
}
