import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatPercent, initials } from "@/lib/format";
import { getTeamAnalytics } from "@/server/analytics";
import { requireAdmin } from "@/server/session";
import { getAdminTeam } from "@/server/teams";
import { AddMember } from "./add-member";
import { EditTeamDialog } from "./edit-team-dialog";
import { MemberActions } from "./member-actions";
import { TeamForm } from "./team-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin();
  const team = await getAdminTeam(admin);

  if (!team) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Create your team" description="Start by creating a team. Then add the people who work with you." />
        <Card>
          <CardContent>
            <TeamForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const analytics = (await getTeamAnalytics(admin))!;

  return (
    <>
      <PageHeader
        title={team.name}
        description={team.description ?? `${analytics.members.length} members`}
        actions={
          <>
            <EditTeamDialog team={team} />
            <AddMember />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {analytics.members.length} {analytics.members.length === 1 ? "person" : "people"} on this team. Click a
            name to see their tasks and activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.members.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No members yet</EmptyTitle>
                <EmptyDescription>
                  Use <strong>Add member</strong> to search for people by name or username once they&apos;ve
                  created an account.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">In progress</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="w-44">Completion rate</TableHead>
                  <TableHead className="text-right">On time</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.members.map(({ user, metrics, joinedAt }) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link href={`/admin/team/${user.id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="grid leading-tight">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.username ? `@${user.username} · ` : ""}joined {formatDate(joinedAt)}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.inProgress}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metrics.overdue > 0 ? (
                        <span className="font-medium text-red-600 dark:text-red-400">{metrics.overdue}</span>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={(metrics.completionRate ?? 0) * 100} className="h-2" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {formatPercent(metrics.completionRate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(metrics.onTimeRate)}</TableCell>
                    <TableCell>
                      <MemberActions
                        userId={user.id}
                        name={user.name}
                        openTasks={metrics.pending + metrics.inProgress + metrics.overdue}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
