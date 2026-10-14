import Link from "next/link";
import { AlertTriangle, Users } from "lucide-react";
import { EmptyIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { formatPercent } from "@/lib/format";
import { isOwner } from "@/server/access";
import type { CurrentUser } from "@/server/session";
import { listManagerCandidates, listTeamsWithMetrics } from "@/server/teams";
import { NewTeamButton } from "../team-dialogs";

/** Team cards: who runs each team, headcount and how its work is going. */
export async function TeamsView({ viewer, base }: { viewer: CurrentUser; base: string }) {
  const owner = isOwner(viewer);
  const [teams, managers] = await Promise.all([
    listTeamsWithMetrics(viewer),
    owner ? listManagerCandidates() : Promise.resolve(undefined),
  ]);

  return (
    <>
      <PageHeader
        title="Teams"
        description={
          owner
            ? "Every team in the company, who manages it and how its work is going."
            : "The teams you manage. Create a team, then add your employees to it."
        }
        actions={<NewTeamButton base={base} managers={managers} />}
      />

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <EmptyIllustration kind="team" />
            <p className="mt-2 font-semibold">No teams yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {owner
                ? "Create a team such as Tech or Business and choose its manager."
                : "Create your first team, then add the employees who report to you."}
            </p>
            <div className="mt-3">
              <NewTeamButton base={base} managers={managers} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {teams.map((team) => {
            const m = team.metrics;
            const open = m.pending + m.inProgress + m.overdue;
            return (
              <li key={team.id}>
                <Link
                  href={`${base}/teams/${team.id}`}
                  className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand-navy/20 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold group-hover:text-brand-navy dark:group-hover:text-white">
                        {team.name}
                      </p>
                      {team.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{team.description}</p>
                      )}
                    </div>
                    {m.overdue > 0 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        <AlertTriangle className="size-3" /> {m.overdue} overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={team.manager.name} id={team.manager.id} />
                    <div className="grid min-w-0 leading-tight">
                      <span className="truncate text-sm font-medium">
                        {team.manager.id === viewer.id ? "You" : team.manager.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {team.manager.role === "ADMIN" ? "Owner, managing directly" : "Manager"}
                      </span>
                    </div>
                    <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="size-4" />
                      {team._count.members}
                    </span>
                  </div>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {open} open · {m.completed} completed
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatPercent(m.completionRate)}
                      </span>
                    </div>
                    <Progress
                      value={(m.completionRate ?? 0) * 100}
                      className="h-1.5 **:data-[slot=progress-indicator]:bg-brand-orange"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
