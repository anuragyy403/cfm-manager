import { AppShell, type NavItem } from "@/components/app-shell";
import { requireMember } from "@/server/session";

const nav: NavItem[] = [
  { href: "/dashboard", label: "My dashboard", icon: "overview", exact: true },
  { href: "/dashboard/tasks", label: "My tasks", icon: "myTasks" },
];

export default async function MemberLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireMember();
  return (
    <AppShell nav={nav} user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </AppShell>
  );
}
