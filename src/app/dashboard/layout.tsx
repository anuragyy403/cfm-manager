import { AppShell, type NavItem } from "@/components/app-shell";
import { requireEmployee } from "@/server/session";

const nav: NavItem[] = [
  { href: "/dashboard", label: "My day", shortLabel: "My day", icon: "overview", exact: true },
  { href: "/dashboard/tasks", label: "My tasks", shortLabel: "Tasks", icon: "myTasks" },
  { href: "/dashboard/team", label: "My team", shortLabel: "Team", icon: "team" },
];

export default async function MemberLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireEmployee();
  return (
    <AppShell nav={nav} user={{ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role }}>
      {children}
    </AppShell>
  );
}
