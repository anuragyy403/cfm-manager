import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { UserAvatar } from "@/components/user-avatar";
import { formatPercent } from "@/lib/format";
import { listPeople } from "@/server/people";
import type { CurrentUser } from "@/server/session";
import { RoleButton } from "../role-button";
import { DeletedTag } from "@/components/deleted-tag";

type Person = Awaited<ReturnType<typeof listPeople>>[number];

/** Owner only: everyone in the company, grouped by role, with promote / demote. */
export async function PeopleView({ owner, base }: { owner: CurrentUser; base: string }) {
  const people = await listPeople(owner);
  const hr = people.filter((p) => p.role === "HR");
  const managers = people.filter((p) => p.role === "MANAGER");
  // Deleted accounts stay listed (last), tagged, with their record.
  const employees = people
    .filter((p) => p.role === "MEMBER")
    .sort((a, b) => Number(!!a.deletedAt) - Number(!!b.deletedAt));
  const deleted = employees.filter((p) => p.deletedAt).length;
  const unassigned = employees.filter((p) => !p.team && !p.deletedAt).length;

  return (
    <>
      <PageHeader
        title="People"
        description={`${hr.length ? `${hr.length} HR, ` : ""}${managers.length} manager${managers.length === 1 ? "" : "s"} and ${employees.length - deleted} employee${
          employees.length - deleted === 1 ? "" : "s"
        }${unassigned ? `, ${unassigned} not on a team yet` : ""}${deleted ? `, plus ${deleted} deleted account${deleted === 1 ? "" : "s"} kept for the record` : ""}. New colleagues appear here once they sign up.`}
      />
      <div className="space-y-6">
        <PeopleTable
          title="HR"
          description="HR works across every team: assigns, manages and reviews any team's tasks. Give HR work through the HR team."
          empty="No one is HR yet. Use “Change role” on a person to make them HR."
          people={hr}
          base={base}
        />
        <PeopleTable
          title="Managers"
          description="Each manager runs one or more teams and sees only those teams' work."
          empty="No managers yet. Use “Change role” on an employee to make them a manager."
          people={managers}
          base={base}
        />
        <PeopleTable
          title="Employees"
          description="Employees see only the tasks assigned to them. Their numbers include work from every team they have been on."
          empty="No employees yet. They appear here after they sign up."
          people={employees}
          base={base}
        />
      </div>
    </>
  );
}

function PeopleTable({
  title,
  description,
  empty,
  people,
  base,
}: {
  title: string;
  description: string;
  empty: string;
  people: Person[];
  base: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="w-44">Completion rate</TableHead>
                <TableHead className="w-36 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => {
                const m = p.metrics;
                const teams = p.role === "MANAGER" || p.role === "HR" ? p.managedTeams : p.team ? [p.team] : [];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`${base}/people/${p.id}`} className="flex items-center gap-3 hover:underline">
                        <UserAvatar name={p.name} id={p.id} />
                        <div className="grid leading-tight">
                          <span className="font-medium">
                            {p.name}
                            {p.deletedAt && <DeletedTag />}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.username ? `@${p.username}` : p.email}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.deletedAt ? (
                        <span className="text-xs text-muted-foreground">Account deleted</span>
                      ) : teams.length === 0 ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          {p.role === "HR" ? "All teams" : p.role === "MANAGER" ? "No team yet" : "Not on a team"}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teams.map((t) => (
                            <Link key={t.id} href={`${base}/teams/${t.id}`}>
                              <Badge variant="secondary" className="hover:bg-secondary/70">
                                {t.name}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.pending + m.inProgress + m.overdue}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.overdue > 0 ? (
                        <span className="font-medium text-red-600 dark:text-red-400">{m.overdue}</span>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={(m.completionRate ?? 0) * 100} className="h-2" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {formatPercent(m.completionRate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.role !== "ADMIN" && !p.deletedAt && (
                        <RoleButton userId={p.id} name={p.name} role={p.role} teamName={p.team?.name} size="sm" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
