import { AppShell, type NavItem } from "@/components/app-shell";
import { countUnread } from "@/server/conversations";
import { requireOwner } from "@/server/session";

const nav: NavItem[] = [
  { href: "/admin", label: "Overview", shortLabel: "Home", icon: "overview", exact: true },
  { href: "/admin/tasks", label: "Tasks", icon: "tasks" },
  { href: "/admin/teams", label: "Teams", icon: "team" },
  { href: "/admin/people", label: "People", icon: "people" },
  { href: "/admin/analytics", label: "Analytics", shortLabel: "Stats", icon: "analytics" },
  { href: "/admin/inbox", label: "Inbox", icon: "inbox" },
];

/** The owner's workspace: every team, manager, employee and task. */
export default async function OwnerLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireOwner();
  const unread = await countUnread(user);
  const badged = nav.map((n) => (n.href === "/admin/inbox" ? { ...n, badge: unread } : n));
  return (
    <AppShell nav={badged} user={{ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role }}>
      {children}
    </AppShell>
  );
}
