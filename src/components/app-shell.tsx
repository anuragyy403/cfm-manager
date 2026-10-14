"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronsUpDown,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Phone,
  UserCog,
  Users,
} from "lucide-react";
import { APP_NAME, BrandMark, COMPANY } from "@/components/brand";
import { AppFooter } from "@/components/site-footer";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const icons = {
  overview: LayoutDashboard,
  tasks: ClipboardList,
  myTasks: ListChecks,
  team: Users,
  analytics: BarChart3,
  account: UserCog,
};

export type NavItem = {
  href: string;
  label: string;
  /** Short label for the phone bottom bar. */
  shortLabel?: string;
  icon: keyof typeof icons;
  /** Match only the exact path (for index routes like /admin). */
  exact?: boolean;
};

type ShellUser = { id: string; name: string; email: string; role: "ADMIN" | "MEMBER" };

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({
  nav,
  user,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const accountItem: NavItem = {
    href: user.role === "ADMIN" ? "/admin/account" : "/dashboard/account",
    label: "Account settings",
    icon: "account",
  };
  const current = nav.find((n) => isActive(n, pathname)) ?? (isActive(accountItem, pathname) ? accountItem : undefined);

  async function signOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="pt-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="hover:bg-transparent active:bg-transparent">
                <Link href="/">
                  <BrandMark className="ring-0" />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold text-white">{APP_NAME}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {user.role === "ADMIN" ? "Admin workspace" : "Team member"}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/45">Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {nav.map((item) => {
                  const Icon = icons[item.icon];
                  const active = isActive(item, pathname);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="h-10 text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent data-[active=true]:text-white data-[active=true]:shadow-[inset_3px_0_0_var(--brand-orange)] [&_svg]:size-[18px] data-[active=true]:[&_svg]:text-brand-orange"
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-auto group-data-[collapsible=icon]:hidden">
            <div className="rounded-xl bg-white/[0.06] p-3 text-xs text-sidebar-foreground/75 ring-1 ring-white/10">
              <p className="mb-2 font-medium text-white">Need help?</p>
              <a href={COMPANY.phoneHref} className="flex items-center gap-2 py-0.5 hover:text-white">
                <Phone className="size-3.5 text-brand-orange" /> {COMPANY.phone}
              </a>
              <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-2 py-0.5 hover:text-white">
                <Mail className="size-3.5 text-brand-orange" />
                <span className="truncate">{COMPANY.email}</span>
              </a>
            </div>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <UserAvatar name={user.name} id={user.id} className="rounded-lg" />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-white">{user.name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-60">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} id={user.id} />
                      <div className="grid min-w-0 text-sm leading-tight">
                        <span className="truncate font-medium">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={accountItem.href}>
                      <UserCog />
                      Account settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:h-[72px] md:px-6">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Link href="/" className="md:hidden" aria-label={APP_NAME}>
            <BrandMark className="size-8" />
          </Link>
          <Separator orientation="vertical" className="hidden data-[orientation=vertical]:h-8 md:block" />
          {current && <PageTitle item={current} workspace={user.role === "ADMIN" ? "Admin workspace" : "My workspace"} />}
          <div className="ml-auto md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
                <UserAvatar name={user.name} id={user.id} size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="grid min-w-0 text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={accountItem.href}>
                    <UserCog />
                    Account settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex-1 p-4 pb-24 md:p-6 md:pb-6 lg:p-8">{children}</div>
        <AppFooter className="mb-16 md:mb-0" />
      </SidebarInset>

      <MobileNav nav={nav} pathname={pathname} />
    </SidebarProvider>
  );
}

/** Current section title in the top bar: icon tile, small workspace label, big bold title. */
function PageTitle({ item, workspace }: { item: NavItem; workspace: string }) {
  const Icon = icons[item.icon];
  return (
    <div key={item.href} className="flex min-w-0 items-center gap-3 animate-in fade-in-0 slide-in-from-left-1 duration-300">
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-[#f58b4c] text-white shadow-md shadow-brand-orange/25 sm:flex">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="hidden text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:block">
          {workspace}
        </p>
        <h2 className="truncate font-heading text-xl font-extrabold tracking-tight text-brand-navy sm:text-2xl dark:text-white">
          {item.label}
        </h2>
      </div>
    </div>
  );
}

/** Bottom navigation bar on phones. */
function MobileNav({ nav, pathname }: { nav: NavItem[]; pathname: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
        {nav.map((item) => {
          const Icon = icons[item.icon];
          const active = isActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-brand-orange",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-brand-orange-soft",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {item.shortLabel ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
