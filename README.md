# CFM Workplace

Clickfieldmedia's team task tracking and management app.

Team task tracking and management. The manager (admin) builds a team, assigns tasks, monitors progress and analyses performance; team members see and update only their own tasks.

See [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the agreed decisions and the permission rules the code enforces.

## Features

**Admin**
- Create a team and add members by searching registered accounts (name or @username)
- Create, edit, reassign, archive and reopen tasks (title, description, priority, deadline, assignee)
- All tasks in one table with status tabs (pending / in progress / overdue / completed / archived), member, priority and text filters
- Task detail with timeline (assigned → started → completed, on time or late), completion note and full history
- Member profiles with metrics, task list and recent activity
- Analytics: completion rate, on-time rate, overdue, average time to complete, weekly trend, workload and rate charts, per-member summary, date-range filter

**Team member**
- Personal dashboard: counts, tasks needing attention (overdue / due within 48 h), completion summary
- My tasks with status tabs, task detail, "Start working" and "Mark as completed" with a required completion note

**Security**
- Role-based access enforced on the server for every page and Server Action (not just hidden buttons)
- Role can never be set at sign-up; admins are granted with `npm run make-admin -- <email>`
- Members can only read/update tasks assigned to them on a team they belong to
- Server-set timestamps, append-only activity log, database-backed sign-in rate limiting, security headers

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL · Prisma 7 · Better Auth · Zod · Tailwind CSS v4 + shadcn/ui · Recharts · Vitest

## Local development

Requirements: Node.js 20+ and Docker.

```bash
npm install
cp .env.example .env          # then set BETTER_AUTH_SECRET
npm run db:up                 # PostgreSQL in Docker on port 5433
npm run db:migrate            # apply migrations
npm run db:seed               # wipe + load demo data (accounts listed in prisma/seed.ts)
npm run dev                   # http://localhost:3000
```

## Tests

```bash
npm run test:db   # once: create tables in the cfm_manager_test database
npm test
```

The test database must exist first: `docker exec cfm-manager-db psql -U cfm -d postgres -c "create database cfm_manager_test"`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm test` | Unit + permission integration tests |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma migrations / demo data / database browser |
| `npm run make-admin -- <email>` | Grant the admin role to an existing account |
