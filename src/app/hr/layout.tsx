import { AppShell, type NavItem } from "@/components/app-shell";
import { countUnread } from "@/server/conversations";
import { requireHR } from "@/server/session";

const nav: NavItem[] = [
  { href: "/hr", label: "Overview", shortLabel: "Home", icon: "overview", exact: true },
  { href: "/hr/my-tasks", label: "My tasks", shortLabel: "Mine", icon: "myTasks" },
  { href: "/hr/tasks", label: "All tasks", shortLabel: "Tasks", icon: "tasks" },
  { href: "/hr/teams", label: "Teams", icon: "team" },
  { href: "/hr/analytics", label: "Analytics", shortLabel: "Stats", icon: "analytics" },
  { href: "/hr/reports", label: "Meeting reports", shortLabel: "Reports", icon: "reports" },
  // Seven won't fit the phone bar; on phones it's linked from Meeting reports.
  { href: "/hr/talk", label: "Talk to owner", shortLabel: "Owner", icon: "talk", hideOnPhone: true },
];

/** HR's workspace: every team's work, plus the work the owner gives HR. */
export default async function HRLayout({ children }: LayoutProps<"/hr">) {
  const user = await requireHR();
  const [reports, cases] = await Promise.all([countUnread(user, "HR_DESK"), countUnread(user, "OWNER_CASE")]);
  const badged = nav.map((n) => (n.href === "/hr/reports" ? { ...n, badge: reports } : n.href === "/hr/talk" ? { ...n, badge: cases } : n));
  return (
    <AppShell nav={badged} user={{ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role }}>
      {children}
    </AppShell>
  );
}
