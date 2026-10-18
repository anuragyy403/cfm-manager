# CFM Workplace — Project Brief

Product name: **CFM Workplace** (by Clickfieldmedia). Name and logo live in `src/components/brand.tsx` and `public/logo.png`.

Task tracking and management for a company with three levels: the owner, managers who run teams, and employees.

## Roles
- **Owner** (stored as role `ADMIN`, exactly one) — sees and controls everything: every team, manager, employee and task. Creates teams and chooses their managers, promotes employees to managers (and back), assigns work to managers or straight to employees, and sees company-wide analytics. Workspace: `/admin`.
- **Manager** (`MANAGER`) — runs one or more teams. Creates their own teams, adds employees, assigns tasks in their teams, splits tasks (including the owner's) into subtasks, works on tasks assigned to them, and sees analytics for their teams only. Workspace: `/manager`.
- **Employee** (stored as role `MEMBER`) — on at most one team; sees only tasks assigned to them and moves them through the workflow. Workspace: `/dashboard`.

## Agreed decisions
1. People sign up themselves; leads find and add them via search. Single company, single owner.
2. The owner role is never chosen at sign-up. It is granted with `npm run make-admin -- <email>`, which refuses if an owner already exists. Managers are promoted by the owner inside the app.
3. Adding someone to a team is direct (no invitation to accept).
4. Work counts as done only when it is **passed in review**. The assignee submits it for review (with a note on what they delivered); the reviewer passes it (optional feedback) or fails it (feedback required), which sends it back as In progress until it is resubmitted. The reviewer is the team's manager; for a manager's own work (from the owner or themselves) it is the owner. The owner may review anything. A lead can still reopen a passed task with a reason (logged, shown to the assignee as the change to make).
5. Leads can edit, reassign and archive tasks; every change is logged. Only the owner can delete a task permanently (with its subtasks and history); archiving is the reversible option.
6. A completion note is required. File uploads and comments are deferred to a later phase.
7. Employees see only their own tasks. Managers see only their own teams.
8. Many teams (e.g. Tech, Business). Each team has one manager; a manager can run several teams; an employee is on one team.
9. Subtasks: one level deep, always in the parent's team. Archiving a task archives its open subtasks.
10. Deadlines are date + time. "Due soon" = within 48 hours.
11. Dashboards refresh on navigation and poll periodically; no realtime service.
12. Completion rate = passed ÷ assigned (non-archived). On-time rate = passed tasks handed in (submitted) by the deadline ÷ passed, so review time never counts against the assignee. First-time pass rate = passed without being sent back ÷ passed. Work waiting for review is never overdue.

## Rules that must always hold (enforced on the server)
- Scopes live in `src/server/access.ts`: the owner sees everything, a manager only teams they manage, an employee only tasks assigned to them.
- A task can only be assigned to its team's manager or one of its employees — never to the owner, never across teams.
- A manager can change (edit, reassign, archive, reopen) tasks in their teams, except tasks the owner created; those only the owner can change. A manager can still split them into subtasks.
- Only the owner changes roles or a team's manager. Nobody can change their own role.
- A manager can only add employees who are not on another team; the owner can move employees between teams.
- Assignees can only read and update tasks assigned to them, and only the status (PENDING → IN_PROGRESS → SUBMITTED) and the completion note. They can never mark their own work completed.
- Only the reviewer (the team's manager, or the owner) can pass or fail submitted work, and nobody reviews work assigned to themselves. Failing requires feedback.
- Nobody can reach another role's pages or data — including via direct Server Action calls.
- Lifecycle timestamps (assigned, started, submitted, completed) are set by the server only.
- "Overdue" is derived (deadline passed and not completed), never stored.
- Task history (`TaskActivity`) is append-only. It is only removed when the owner permanently deletes its task.
- Only the owner can permanently delete a task (checked on the server).
- Removing someone from a team keeps their task history.

## Stack
Next.js 16 (App Router, TypeScript) · PostgreSQL · Prisma 7 · Better Auth · Zod · Tailwind CSS v4 + shadcn/ui · Recharts.

## Local development
```bash
npm install
npm run db:up        # starts PostgreSQL in Docker on port 5433
npm run db:migrate   # applies migrations
npm run db:seed      # wipes and seeds local data (see prisma/seed.ts for test accounts)
npm run dev
```
