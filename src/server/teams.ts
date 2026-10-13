import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/server/session";

/**
 * Team data access. Every function takes the already-verified admin and only
 * ever touches teams that admin owns.
 */

export class DomainError extends Error {}

/** v1 has one team per admin: the oldest team they own. */
export async function getAdminTeam(admin: CurrentUser) {
  return prisma.team.findFirst({
    where: { ownerId: admin.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function createTeam(
  admin: CurrentUser,
  input: { name: string; description: string },
) {
  const existing = await getAdminTeam(admin);
  if (existing) throw new DomainError("You already have a team.");
  return prisma.team.create({
    data: { name: input.name, description: input.description || null, ownerId: admin.id },
  });
}

export async function updateTeam(
  admin: CurrentUser,
  input: { name: string; description: string },
) {
  const team = await getAdminTeam(admin);
  if (!team) throw new DomainError("Create your team first.");
  return prisma.team.update({
    where: { id: team.id },
    data: { name: input.name, description: input.description || null },
  });
}

export async function listTeamMembers(teamId: string) {
  return prisma.teamMember.findMany({
    where: { teamId },
    orderBy: { user: { name: "asc" } },
    select: {
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, username: true, image: true } },
    },
  });
}

/** Team members for the assignee picker, with how many open tasks each already has. */
export async function listMemberOptions(teamId: string) {
  const [members, open] = await Promise.all([
    listTeamMembers(teamId),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { teamId, archivedAt: null, status: { not: "COMPLETED" } },
      _count: { _all: true },
    }),
  ]);
  const openBy = new Map(open.map((o) => [o.assigneeId, o._count._all]));
  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    username: m.user.username,
    openTasks: openBy.get(m.user.id) ?? 0,
  }));
}

export type UserSearchResult = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  inTeam: boolean;
};

/**
 * Instagram-style lookup of registered team-member accounts by name or
 * username. Emails are deliberately not returned.
 */
export async function searchUsers(
  admin: CurrentUser,
  query: string,
): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const team = await getAdminTeam(admin);

  const users = await prisma.user.findMany({
    where: {
      role: "MEMBER",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q.toLowerCase().replace(/^@/, "") } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: 8,
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      memberships: team ? { where: { teamId: team.id }, select: { id: true } } : false,
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    inTeam: Array.isArray(u.memberships) && u.memberships.length > 0,
  }));
}

export async function addMember(admin: CurrentUser, userId: string) {
  const team = await getAdminTeam(admin);
  if (!team) throw new DomainError("Create your team first.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new DomainError("That account no longer exists.");
  if (user.role !== "MEMBER") throw new DomainError("Admins can't be added as team members.");

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId } },
    update: {},
    create: { teamId: team.id, userId, addedById: admin.id },
  });
  return user;
}

/**
 * Removes a member from the team. Their tasks and history are kept; open tasks
 * stay assigned to them until the admin reassigns them.
 */
export async function removeMember(admin: CurrentUser, userId: string) {
  const team = await getAdminTeam(admin);
  if (!team) throw new DomainError("Create your team first.");
  const { count } = await prisma.teamMember.deleteMany({
    where: { teamId: team.id, userId },
  });
  if (count === 0) throw new DomainError("That person isn't on your team.");
}

export async function isTeamMember(teamId: string, userId: string) {
  const m = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });
  return m !== null;
}
