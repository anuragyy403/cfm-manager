import type { Metadata } from "next";
import Link from "next/link";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatPercent } from "@/lib/format";
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
        <div className="mb-6 flex justify-center">
          <EmptyIllustration kind="team" className="h-32" />
        </div>
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
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EmptyIllustration kind="team" />
              <p className="mt-2 font-semibold">No members yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask your colleagues to sign up, then use <strong>Add member</strong> to find them by name or
                username.
              </p>
              <div className="mt-3">
                <AddMember />
              </div>
            </div>
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
                        <UserAvatar name={user.name} id={user.id} />
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
