import { AppShell, type NavItem } from "@/components/app-shell";
import { countUnread } from "@/server/conversations";
import { requireEmployee } from "@/server/session";

const nav: NavItem[] = [
  { href: "/dashboard", label: "My day", shortLabel: "My day", icon: "overview", exact: true },
  { href: "/dashboard/tasks", label: "My tasks", shortLabel: "Tasks", icon: "myTasks" },
  { href: "/dashboard/team", label: "My team", shortLabel: "Team", icon: "team" },
  { href: "/dashboard/talk", label: "Talk to owner", shortLabel: "Owner", icon: "talk" },
];

export default async function MemberLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireEmployee();
  const unread = await countUnread(user);
  const badged = nav.map((n) => (n.href === "/dashboard/talk" ? { ...n, badge: unread } : n));
  return (
    <AppShell nav={badged} user={{ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role }}>
      {children}
    </AppShell>
  );
}
