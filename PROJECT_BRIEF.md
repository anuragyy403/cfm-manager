# CFM Workplace — Project Brief

Product name: **CFM Workplace** (by Clickfieldmedia). Name and logo live in `src/components/brand.tsx` and `public/logo.png`.

Team task tracking and management for a company manager (admin) and their team members.

## Roles
- **Admin** — creates the team, adds members (by searching registered users), creates and assigns tasks, monitors every task, and sees performance analytics.
- **Team Member** — sees only tasks assigned to them, moves them through the workflow, and reports completion.

## Agreed decisions (v1)
1. Members sign up themselves; the admin finds and adds them via search. Single company, single admin.
2. The admin role is never chosen at sign-up. It is granted with `npm run make-admin -- <email>`.
3. Adding a member is direct (no invitation to accept).
4. "Completed" counts when the member marks it. The admin can reopen a task with a reason (logged).
5. The admin can edit, reassign and archive tasks; every change is logged.
6. A completion note is required. File uploads and comments are deferred to a later phase.
7. Members see only their own tasks.
8. One team in v1; the schema supports more.
9. Deadlines are date + time. "Due soon" = within 48 hours.
10. Dashboards refresh on navigation and poll periodically; no realtime service.
11. Completion rate = completed ÷ assigned (non-archived). On-time rate = completed by deadline ÷ completed.

## Rules that must always hold (enforced on the server)
- Only an admin can create, assign, reassign, edit, archive or reopen tasks.
- A task can only be assigned to a current member of the admin's team.
- Members can only read and update tasks where they are the assignee.
- Members can change only the status (PENDING → IN_PROGRESS → COMPLETED) and the completion note.
- Members cannot reach admin pages, admin data, or other members' tasks — including via direct API calls.
- Lifecycle timestamps (assigned, started, completed) are set by the server only.
- "Overdue" is derived (deadline passed and not completed), never stored.
- Task history (`TaskActivity`) is append-only.
- Removing a member from the team keeps their task history.

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
