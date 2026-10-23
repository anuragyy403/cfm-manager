# CFM Workplace — Project Brief

Product name: **CFM Workplace** (by Clickfieldmedia). Name and logo live in `src/components/brand.tsx` and `public/logo.png`.

Task tracking and management for a company with three levels: the owner, managers who run teams, and employees.

## Roles
- **Owner** (stored as role `ADMIN`, exactly one) — sees and controls everything: every team, manager, employee and task. Creates teams and chooses their managers, promotes employees to managers (and back), assigns work to managers or straight to employees, and sees company-wide analytics. Workspace: `/admin`.
- **HR** (`HR`, one or more) — works across every team, below the owner and above managers. Sees every team, assigns tasks to managers and employees in any team, edits / reassigns / archives any team's tasks except the owner's, reviews (passes or fails) anyone's work except their own, and sees company-wide analytics. Does not change teams (create, rename, add or remove people, choose managers) or roles: those stay with the owner. Gets work only from the owner, who picks HR directly (no team to choose); the server files it under an "HR" team that HR heads, created on first use. The owner reviews HR's own work. Only the owner makes someone HR. Workspace: `/hr`.
- **Manager** (`MANAGER`) — runs one or more teams. Creates their own teams, adds employees, assigns tasks in their teams, splits tasks (including the owner's) into subtasks, works on tasks assigned to them, and sees analytics for their teams only. Workspace: `/manager`.
- **Employee** (stored as role `MEMBER`) — on at most one team; sees only tasks assigned to them and moves them through the workflow. Workspace: `/dashboard`.

## Agreed decisions
1. People sign up themselves; leads find and add them via search. Single company, single owner.
2. The owner role is never chosen at sign-up. It is granted with `npm run make-admin -- <email>`, which refuses if an owner already exists. Managers are promoted by the owner inside the app.
3. Adding someone to a team is direct (no invitation to accept).
4. Work counts as done only when it is **passed in review**. The assignee submits it for review (with a note on what they delivered); the reviewer passes it (optional feedback) or fails it (feedback required), which sends it back as In progress until it is resubmitted. The reviewer is the team's manager; for a manager's own work (from the owner or themselves) it is the owner. The owner may review anything. A lead can still reopen a passed task with a reason (logged, shown to the assignee as the change to make).
5. Leads can edit, reassign and archive tasks; every change is logged. Only the person who assigned a task can delete it permanently (with its subtasks and history), not even the owner otherwise; archiving is the reversible option.
6. A completion note is required. The assignee can attach photos and videos when submitting, and the reviewer when passing or failing (up to 6 per step; videos up to 50 MB; photos shrunk in the browser). Each submission or verdict keeps its own files, so every round stays on record. Files live in the private Blob store `cfm-attachments` (token `ATTACHMENTS_READ_WRITE_TOKEN`) and are only opened through `/api/files/[id]`, which checks the viewer can see the task.
7. Employees see only their own tasks. Managers see only their own teams.
8. Many teams (e.g. Tech, Business). Each team has one manager; a manager can run several teams; an employee is on one team.
9. Subtasks: one level deep, always in the parent's team. Archiving a task archives its open subtasks.
10. Deadlines are date + time. "Due soon" = within 48 hours.
11. Dashboards refresh on navigation and poll periodically; no realtime service.
12. Completion rate = passed ÷ assigned (non-archived). On-time rate = passed tasks handed in (submitted) by the deadline ÷ passed, so review time never counts against the assignee. First-time pass rate = passed without being sent back ÷ passed. Work waiting for review is never overdue.
13. Work reports filter by team, individual assignee, and inclusive assignment dates in the company timezone. Reports and CSV exports use the same server-side scopes: owner/HR company-wide, managers' own teams, employees' own tasks. Only passed tasks count as done; submitted work is separately marked waiting for review. Archived tasks are excluded and subtasks count separately. Reports support CSV and print/save PDF.
14. Employee chat is a separate direct-message section available to every active account across roles and teams. Only the two participants can read a chat or its files, including when the viewer is the owner or HR. It never shares tables or access rules with private owner cases and HR reports. Images/videos use the existing limits; PDF, DOCX, XLSX, PPTX, TXT, CSV and ZIP documents are supported up to 25 MB, six files per message. Deleted accounts keep read-only history. Sender-only deletion within five minutes leaves a placeholder. Chat polls every five seconds while visible.

## Rules that must always hold (enforced on the server)
- Scopes live in `src/server/access.ts`: the owner sees everything, a manager only teams they manage, an employee only tasks assigned to them.
- A task can only be assigned to its team's manager or one of its employees — never to the owner, never across teams, and never by someone to themselves.
- New tasks start from the person: the team follows from who they are (asked only when they head several teams). Analytics for the owner and HR list everyone, HR included.
- A manager can change (edit, reassign, archive, reopen) tasks in their teams, except tasks the owner or HR created; those only the owner (or HR, for HR's tasks) can change. A manager can still split them into subtasks.
- HR can change any team's tasks except the owner's, but never the teams themselves or anyone's role. Only the owner assigns work to HR.
- Only the owner changes roles or a team's manager. Nobody can change their own role.
- A manager can only add employees who are not on another team; the owner can move employees between teams.
- Assignees can only read and update tasks assigned to them, and only the status (PENDING → IN_PROGRESS → SUBMITTED) and the completion note. They can never mark their own work completed.
- Only the reviewer (the team's manager, or the owner) can pass or fail submitted work, and nobody reviews work assigned to themselves. Failing requires feedback.
- Nobody can reach another role's pages or data — including via direct Server Action calls.
- Lifecycle timestamps (assigned, started, submitted, completed) are set by the server only.
- "Overdue" is derived (deadline passed and not completed), never stored.
- Task history (`TaskActivity`) is append-only. It is only removed when its task is permanently deleted.
- Only whoever assigned a task can permanently delete it (checked on the server), and only when every subtask under it is theirs too. Everyone else can at most archive it.
- Only the owner can delete an employee account (employees only; leads are changed to employee first). It's a soft delete (`User.deletedAt`): they're signed out, can't sign in or get a reset link, come off their team and are never offered for new work, but every task, review and history entry stays and they show with a "Deleted" tag.
- Only the owner can delete a team. Its tasks first move to another team the owner chooses, so no one's work record is lost; its employees end up without a team.
- Removing someone from a team keeps their task history.
- Private conversations with the owner (`canSeeConversation` in `src/server/access.ts`): only the person who started one and the owner can ever see it or its files. Not HR, not managers, and never the person a case is about (they are not notified either). Notifications never include what was written.
- "Talk to the owner": anyone except the owner can raise a case (category, optional "who it's about", urgency, text, photos/videos). The owner's first reply moves it to "in discussion"; only the owner marks it resolved or reopens it; a new message from whoever raised it reopens a resolved case. No anonymous cases.
- HR's desk: each HR person has one private channel with the owner for meeting reports (date, title, attendees, what was discussed, decisions, action items, photos/videos) and messages. Only HR sends reports; the owner reads and replies (replies can quote a report).
- Messages can be deleted only by their sender, only in the first 5 minutes; a "deleted" placeholder stays and its files are removed. Deleting the first message of a case withdraws the case. After 5 minutes everything stays on record.

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
