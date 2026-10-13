import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  KanbanSquare,
  Target,
} from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { GettingStarted } from "@/components/getting-started";
import { EmptyIllustration } from "@/components/illustrations";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { WelcomeBanner } from "@/components/welcome-banner";
import { formatPercent } from "@/lib/format";
import { getTeamAnalytics } from "@/server/analytics";
import { requireAdmin } from "@/server/session";
import { listAttentionTasks, listTeamActivity } from "@/server/tasks";
import { getAdminTeam, listMemberOptions } from "@/server/teams";
import { NewTaskButton } from "./tasks/new-task-button";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const team = await getAdminTeam(admin);

  if (!team) {
    return (
      <>
        <WelcomeBanner
          name={admin.name}
          subtitle="Welcome to CFM Workplace. Set up your team and start assigning work in a couple of minutes."
        />
        <GettingStarted
          steps={[
            {
              label: "Create your team",
              description: "Give your team a name. You can change it any time.",
              done: false,
              href: "/admin/team",
              cta: "Create team",
            },
            {
              label: "Add your people",
              description: "Search for colleagues who have signed up and add them.",
              done: false,
              href: "/admin/team",
              cta: "Add members",
            },
            {
              label: "Assign the first task",
              description: "Create a task with a deadline and pick who owns it.",
              done: false,
              href: "/admin/tasks",
              cta: "Create a task",
            },
          ]}
        />
      </>
    );
  }

  const [analytics, attention, activity, memberOptions] = await Promise.all([
    getTeamAnalytics(admin),
    listAttentionTasks(admin),
    listTeamActivity(admin, 10),
    listMemberOptions(team.id),
  ]);
  const m = analytics!.team;
  const ranked = [...analytics!.members].sort(
    (a, b) => b.metrics.overdue - a.metrics.overdue || (a.metrics.completionRate ?? 1) - (b.metrics.completionRate ?? 1),
  );
  const open = m.pending + m.inProgress + m.overdue;

  return (
    <>
      <AutoRefresh />
      <WelcomeBanner
        name={admin.name}
        subtitle={
          m.total === 0
            ? `${team.name} is ready. Assign the first task to get things moving.`
            : `${team.name} has ${open} open task${open === 1 ? "" : "s"}${
                m.overdue ? `, ${m.overdue} overdue` : ""
              }. ${attention.length ? "A few need your attention below." : "Everything is on track."}`
        }
        actions={
          <>
            <NewTaskButton members={memberOptions} />
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Link href="/admin/tasks?layout=board">
                <KanbanSquare />
                Task board
              </Link>
            </Button>
          </>
        }
        aside={<ProgressRing value={m.completionRate} size={112} label="team completion" />}
      />

      <GettingStarted
        steps={[
          { label: "Create your team", description: "Done. Rename it any time from the Team page.", done: true, href: "/admin/team", cta: "Open team" },
          {
            label: "Add your people",
            description: "Search for colleagues who have signed up and add them.",
            done: memberOptions.length > 0,
            href: "/admin/team",
            cta: "Add members",
          },
          {
            label: "Assign the first task",
            description: "Create a task with a deadline and pick who owns it.",
            done: m.total > 0,
            href: "/admin/tasks",
            cta: "Create a task",
          },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total tasks" value={m.total} icon={ClipboardList} hint={`${m.pending} not started`} />
        <StatCard label="In progress" value={m.inProgress} icon={CircleDot} tone="blue" />
        <StatCard label="Completed" value={m.completed} icon={CheckCircle2} tone="green" />
        <StatCard label="Overdue" value={m.overdue} icon={AlertTriangle} tone={m.overdue ? "red" : "default"} />
        <StatCard label="Completion rate" value={formatPercent(m.completionRate)} icon={Target} tone="orange" />
        <StatCard
          label="On-time rate"
          value={formatPercent(m.onTimeRate)}
          icon={Clock}
          tone="amber"
          hint={`${m.completedLate} completed late`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Open tasks that are overdue or due in the next 48 hours.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/tasks?view=OVERDUE">
                    Overdue tasks <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {attention.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <EmptyIllustration kind="done" className="h-24" />
                  <p className="font-medium">Nothing urgent</p>
                  <p className="text-sm text-muted-foreground">Every open task is on track.</p>
                </div>
              ) : (
                attention.map((t) => (
                  <TaskListItem key={t.id} task={t} href={`/admin/tasks/${t.id}`} assignee={t.assignee} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team at a glance</CardTitle>
              <CardDescription>Members with overdue work or low completion appear first.</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/analytics">
                    Full analytics <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {ranked.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <EmptyIllustration kind="team" className="h-24" />
                  <p className="text-sm text-muted-foreground">
                    No members yet.{" "}
                    <Link href="/admin/team" className="font-medium text-brand-orange-hover hover:underline">
                      Add your team
                    </Link>
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {ranked.map(({ user, metrics }) => (
                    <li key={user.id}>
                      <Link
                        href={`/admin/team/${user.id}`}
                        className="flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-px hover:shadow-md"
                      >
                        <UserAvatar name={user.name} id={user.id} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{user.name}</span>
                            {metrics.overdue > 0 ? (
                              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                                {metrics.overdue} overdue
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {metrics.completed}/{metrics.total} done
                              </span>
                            )}
                          </div>
                          <Progress
                            value={(metrics.completionRate ?? 0) * 100}
                            className="mt-2 h-1.5 **:data-[slot=progress-indicator]:bg-brand-orange"
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest updates from your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activity} taskHref={(id) => `/admin/tasks/${id}`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
