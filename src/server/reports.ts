import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE, formatDateTime } from "@/lib/format";
import { isOverdue } from "@/lib/tasks/rules";
import { DomainError, myTeamsWhere, myWorkScope, seesAllTeams, taskScope, teamScope } from "@/server/access";
import type { CurrentUser } from "@/server/session";

export type ReportParams = Record<string, string | string[] | undefined>;
const dateSchema = z.iso.date();
const single = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

/** Local midnight in the company timezone, independent of the server's zone. */
export function reportDayStart(day: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let instant = target;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    instant += target - local;
  }
  return new Date(instant);
}

export function parseReportFilters(params: ReportParams) {
  const from = single(params.from);
  const to = single(params.to);
  if ((from && !dateSchema.safeParse(from).success) || (to && !dateSchema.safeParse(to).success)) {
    throw new DomainError("Choose valid start and end dates.");
  }
  if (from && to && from > to) throw new DomainError("The end date must be on or after the start date.");
  const nextDay = to ? new Date(`${to}T00:00:00Z`) : undefined;
  nextDay?.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    teamId: single(params.team), personId: single(params.person), from, to,
    assignedAt: { ...(from ? { gte: reportDayStart(from) } : {}), ...(nextDay ? { lt: reportDayStart(nextDay.toISOString().slice(0, 10)) } : {}) },
  };
}

export async function getWorkReport(viewer: CurrentUser, params: ReportParams) {
  const filters = parseReportFilters(params);
  const scope = viewer.role === "MEMBER" ? myWorkScope(viewer) : taskScope(viewer);
  // Options come from the same authorized task set, including former assignees.
  const options = await prisma.task.findMany({
    where: { AND: [scope, { archivedAt: null }] }, distinct: ["teamId", "assigneeId"],
    select: { team: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true, deletedAt: true } } },
  });
  const currentTeams = await prisma.team.findMany({
    where: viewer.role === "MEMBER" ? myTeamsWhere(viewer) : teamScope(viewer),
    select: { id: true, name: true },
  });
  const teams = [...new Map([...currentTeams, ...options.map((r) => r.team)].map((t) => [t.id, t])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const currentPeople = await prisma.user.findMany({
    where: viewer.role === "MEMBER" ? { id: viewer.id } : seesAllTeams(viewer)
      ? { deletedAt: null, role: { not: "ADMIN" } }
      : { deletedAt: null, OR: [{ managedTeams: { some: teamScope(viewer) } }, { memberships: { some: { team: teamScope(viewer) } } }] },
    select: { id: true, name: true, deletedAt: true, managedTeams: { where: { id: { in: teams.map((t) => t.id) } }, select: { id: true } }, memberships: { where: { teamId: { in: teams.map((t) => t.id) } }, select: { teamId: true } } },
  });
  const personMap = new Map<string, { id: string; name: string; deletedAt: Date | null; teamIds: string[] }>();
  for (const person of currentPeople) personMap.set(person.id, { id: person.id, name: person.name, deletedAt: person.deletedAt, teamIds: [...person.managedTeams.map((t) => t.id), ...person.memberships.map((m) => m.teamId)] });
  for (const option of options) {
    const person = personMap.get(option.assignee.id) ?? { ...option.assignee, teamIds: [] };
    person.teamIds = [...new Set([...person.teamIds, option.team.id])];
    personMap.set(person.id, person);
  }
  const people = [...personMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (filters.teamId && !teams.some((t) => t.id === filters.teamId)) throw new DomainError("This team is unavailable in your reports. Clear the team filter.");
  if (filters.personId && !people.some((p) => p.id === filters.personId && (!filters.teamId || p.teamIds.includes(filters.teamId)))) throw new DomainError("This employee is unavailable for the selected team. Clear the employee filter.");
  const tasks = await prisma.task.findMany({
    where: { AND: [scope, {
      archivedAt: null,
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.personId ? { assigneeId: filters.personId } : {}),
      ...(filters.from || filters.to ? { assignedAt: filters.assignedAt } : {}),
    }] },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    select: {
      id: true, title: true, status: true, priority: true, dueAt: true, assignedAt: true,
      submittedAt: true, completedAt: true, completionNote: true, timesFailed: true, parentId: true,
      team: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } },
    },
  });
  const now = new Date();
  const rows = tasks.map((task) => ({ ...task, overdue: isOverdue(task, now) }));
  return { filters, teams, people, rows, generatedAt: now };
}

export type WorkReport = Awaited<ReturnType<typeof getWorkReport>>;
export function reportStatus(row: WorkReport["rows"][number]) {
  return row.status === "COMPLETED" ? "Done — passed review" : row.status === "SUBMITTED" ? "Waiting for review" : row.overdue ? "Not done — overdue" : row.status === "IN_PROGRESS" ? "Not done — in progress" : "Not done — pending";
}

/** Neutralize spreadsheet formulas, including leading whitespace/control characters. */
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function reportCsv(report: WorkReport) {
  const records = [
    ["CFM Workplace work report", "Generated", formatDateTime(report.generatedAt), "Timezone", APP_TIMEZONE],
    ["Assigned from", report.filters.from || "No start date", "Assigned through", report.filters.to || "No end date"],
    ["Team", report.teams.find((t) => t.id === report.filters.teamId)?.name || "All permitted teams", "Employee", report.people.find((p) => p.id === report.filters.personId)?.name || "All permitted employees"],
    ["Task", "Team", "Employee", "Result", "Priority", "Assigned", "Due", "Submitted", "Passed", "Completion note", "Revisions", "Subtask"],
    ...report.rows.map((r) => [r.title, r.team.name, r.assignee.name, reportStatus(r), r.priority, formatDateTime(r.assignedAt), formatDateTime(r.dueAt), r.submittedAt ? formatDateTime(r.submittedAt) : "", r.completedAt ? formatDateTime(r.completedAt) : "", r.completionNote, r.timesFailed, r.parentId ? "Yes" : "No"]),
  ];
  return "\ufeff" + records.map((record) => record.map(csvCell).join(",")).join("\r\n");
}
