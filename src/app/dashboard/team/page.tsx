import type { Metadata } from "next";
import { Crown } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate } from "@/lib/format";
import { requireEmployee } from "@/server/session";
import { getMyTeam } from "@/server/teams";

export const metadata: Metadata = { title: "My team" };

export default async function MyTeamPage() {
  const employee = await requireEmployee();
  const team = await getMyTeam(employee);

  if (!team) {
    return (
      <>
        <PageHeader title="My team" />
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-14 text-center">
          <EmptyIllustration kind="team" />
          <p className="mt-2 font-semibold">You&apos;re not on a team yet</p>
          <p className="text-sm text-muted-foreground">When a manager adds you to a team, it will show here.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title={team.name}
        description={team.description ?? `You've been on this team since ${formatDate(team.joinedAt)}.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Manager</CardTitle>
            <CardDescription>Assigns and reviews this team&apos;s work.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <UserAvatar name={team.manager.name} id={team.manager.id} image={team.manager.image} size="md" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {team.manager.name}
                <Crown className="size-3.5 text-sun-deep" aria-hidden />
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {team.manager.role === "ADMIN" ? "Owner" : team.manager.username ? `@${team.manager.username}` : "Manager"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {team.members.length} {team.members.length === 1 ? "person" : "people"} on {team.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {team.members.map(({ user, joinedAt }) => (
                <li key={user.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <UserAvatar name={user.name} id={user.id} image={user.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.username ? `@${user.username} · ` : ""}Joined {formatDate(joinedAt)}
                    </p>
                  </div>
                  {user.id === employee.id && <Badge variant="secondary">You</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
