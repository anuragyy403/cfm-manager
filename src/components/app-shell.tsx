"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Phone,
  Search,
  UserCog,
  Users,
  UsersRound,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { APP_TIMEZONE } from "@/lib/format";
import { type AppRole, HOME_PATHS, ROLE_LABELS, WORKSPACE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

const icons = {
  overview: LayoutDashboard,
  tasks: ClipboardList,
  myTasks: ListChecks,
  team: Users,
  people: UsersRound,
  analytics: BarChart3,
  account: UserCog,
};

export type NavItem = {
  href: string;
  label: string;
  /** Short label for the phone bottom bar (and sidebar tiles when the label is long). */
  shortLabel?: string;
  icon: keyof typeof icons;
  /** Match only the exact path (for index routes like /admin). */
  exact?: boolean;
};

type ShellUser = { id: string; name: string; email: string; role: AppRole };

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Shortcuts under the tiles, like the "Favorite" list on the reference design. */
function quickLinks(role: AppRole) {
  const tasks = `${HOME_PATHS[role]}/tasks`;
  return role === "MEMBER"
    ? [
        { href: `${tasks}?view=OVERDUE`, label: "Overdue tasks" },
        { href: `${tasks}?view=IN_PROGRESS`, label: "In progress" },
        { href: `${tasks}?view=COMPLETED`, label: "Completed" },
      ]
    : [
        { href: `${tasks}?view=OVERDUE`, label: "Overdue tasks" },
        { href: `${tasks}?layout=board`, label: "Task board" },
        { href: `${tasks}?view=IN_PROGRESS`, label: "In progress" },
      ];
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: APP_TIMEZONE,
  }).format(new Date());
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
  const base = HOME_PATHS[user.role];
  const accountItem: NavItem = { href: `${base}/account`, label: "Account settings", shortLabel: "Account", icon: "account" };
  const tiles = [...nav, accountItem];
  const current = tiles.find((n) => isActive(n, pathname));
  const onHome = pathname === base;

  async function signOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  const accountMenu = (
    <DropdownMenuContent side="top" align="start" className="w-60 rounded-2xl">
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
  );

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <Sidebar collapsible="offcanvas" className="border-r-0">
        <SidebarHeader className="px-4 pt-5 pb-3">
          <Link href={base} className="flex items-center gap-3">
            <BrandMark className="size-10 shadow-[0_4px_14px_-4px_rgb(0_0_0/0.5)] ring-2 ring-white/15" />
            <div className="grid min-w-0 gap-0.5 leading-tight">
              <span className="truncate text-base font-semibold tracking-tight text-white">{APP_NAME}</span>
              <span className="truncate text-xs text-white/60">{WORKSPACE_LABELS[user.role]}</span>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="gap-6 px-3 pt-1 pb-2">
          {user.role !== "MEMBER" && <SidebarSearch action={`${base}/tasks`} />}
          <NavTiles tiles={tiles} pathname={pathname} />
          <SidebarSection title="Quick links">
            <ul className="space-y-px">
              {quickLinks(user.role).map((l) => (
                <li key={l.href}>
                  <SidebarLink href={l.href} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] text-white/85 transition-colors hover:bg-white/[0.07] hover:text-white">
                    <span className="size-2.5 rounded-full bg-sun shadow-[0_0_0_3px_rgb(245_193_39/0.15)]" aria-hidden />
                    {l.label}
                  </SidebarLink>
                </li>
              ))}
            </ul>
          </SidebarSection>
          <SidebarSection title="Need help?">
            <div className="space-y-2">
              <a href={COMPANY.phoneHref} className={pillClass}>
                <Phone className="size-4 shrink-0 text-white/70" /> {COMPANY.phone}
              </a>
              <a href={`mailto:${COMPANY.email}`} className={pillClass}>
                <Mail className="size-4 shrink-0 text-white/70" />
                <span className="truncate">{COMPANY.email}</span>
              </a>
            </div>
          </SidebarSection>
        </SidebarContent>

        <SidebarFooter className="px-3 pt-3 pb-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full border border-white/[0.06] bg-[#151412] py-2 pr-3.5 pl-2 text-left text-white shadow-[0_10px_24px_-12px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.05)] outline-none transition-colors hover:bg-[#1b1a17] focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <UserAvatar
                  name={user.name}
                  id={user.id}
                  size="md"
                  className="ring-1 ring-white/20 *:data-[slot=avatar-fallback]:bg-[#26241f] *:data-[slot=avatar-fallback]:text-white"
                />
                <span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                  <span className="truncate text-sm font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-white/55">{ROLE_LABELS[user.role]}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-white/60" />
              </DropdownMenuTrigger>
              {accountMenu}
            </DropdownMenu>
            <SidebarLink
              href={accountItem.href}
              aria-label="Account settings"
              className="flex size-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-colors hover:bg-white/[0.13] hover:text-white"
            >
              <UserCog className="size-5" />
            </SidebarLink>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent [background:var(--sun-panel)]">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-sun-line/70 bg-[#f6f2e8]/75 px-4 backdrop-blur-xl md:h-[68px] md:px-6 dark:bg-[#1a1915]/75">
          <SidebarTrigger className="-ml-1 hidden size-9 rounded-full border border-sun-line bg-sun-raised/80 md:inline-flex" />
          <Link href={base} className="md:hidden" aria-label={APP_NAME}>
            <BrandMark className="size-8" />
          </Link>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {onHome || !current ? (
              <span className="truncate font-medium text-foreground">{current?.label ?? "Home"}</span>
            ) : (
              <>
                <Link href={base} className="hidden text-muted-foreground hover:text-foreground sm:inline">
                  Home
                </Link>
                <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/60 sm:block" aria-hidden />
                <Link href={current.href} className="truncate font-medium text-foreground">
                  {current.label}
                </Link>
              </>
            )}
            <span className="ml-2 hidden rounded-full border border-sun-line bg-sun-raised/70 px-2.5 py-0.5 text-[11px] text-muted-foreground lg:inline">
              {WORKSPACE_LABELS[user.role]}
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-2 rounded-full border border-sun-line bg-sun-raised/80 px-3 py-1.5 text-xs text-muted-foreground sm:flex"
              suppressHydrationWarning
            >
              <CalendarDays className="size-3.5" />
              {todayLabel()}
            </span>
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
                  <UserAvatar name={user.name} id={user.id} size="sm" />
                </DropdownMenuTrigger>
                {accountMenu}
              </DropdownMenu>
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 pb-24 md:p-6 md:pb-6 lg:p-8">{children}</div>
        <AppFooter className="mb-16 border-sun-line/70 md:mb-0" />
      </SidebarInset>

      <MobileNav nav={nav} pathname={pathname} />
    </SidebarProvider>
  );
}

const pillClass =
  "flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[13.5px] text-white/85 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition-colors hover:bg-white/[0.11] hover:text-white";

/** A link that also closes the sidebar sheet on phones. */
function SidebarLink(props: React.ComponentProps<typeof Link>) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Link
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (isMobile) setOpenMobile(false);
      }}
    />
  );
}

function SidebarSearch({ action }: { action: string }) {
  return (
    <form action={action} role="search" className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-white/60" />
      <input
        name="q"
        placeholder="Search tasks"
        aria-label="Search tasks"
        className="h-11 w-full rounded-full border border-white/10 bg-white/[0.06] pr-4 pl-10 text-sm text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] outline-none transition-colors placeholder:text-white/55 hover:bg-white/[0.09] focus-visible:border-white/25 focus-visible:bg-white/[0.1]"
      />
    </form>
  );
}

/** Square navigation tiles in two columns; the current page is the dark tile. */
function NavTiles({ tiles, pathname }: { tiles: NavItem[]; pathname: string }) {
  return (
    <nav aria-label="Main" className="grid grid-cols-2 gap-2.5">
      {tiles.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(item, pathname);
        return (
          <SidebarLink
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[84px] flex-col items-center justify-center gap-2 rounded-[18px] border text-[13px] font-medium transition-all",
              active
                ? "border-white/[0.08] bg-sidebar-primary text-white shadow-[0_12px_24px_-10px_rgb(0_0_0/0.75),inset_0_1px_0_rgb(255_255_255/0.07)]"
                : "border-white/[0.07] bg-white/[0.07] text-white/85 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] hover:-translate-y-px hover:bg-white/[0.11] hover:text-white",
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
            <span className="max-w-full truncate px-1">
              {item.label.length > 12 ? (item.shortLabel ?? item.label) : item.label}
            </span>
          </SidebarLink>
        );
      })}
    </nav>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 px-2 text-[13px] font-medium text-white/70">
        <ChevronDown className="size-3.5" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Bottom navigation bar on phones. */
function MobileNav({ nav, pathname }: { nav: NavItem[]; pathname: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-sun-line bg-[#f6f2e8]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:bg-[#1a1915]/90"
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
                  active && "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-ink text-white dark:text-[#1f1e1b]",
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
