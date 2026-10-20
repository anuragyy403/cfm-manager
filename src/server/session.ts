import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";
import { HOME_PATHS } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  role: Role;
};

/**
 * Resolves the signed-in user for this request, or null.
 *
 * The role is always re-read from the database rather than trusted from the
 * session payload, so a role change takes effect immediately.
 * Wrapped in React `cache` so it runs once per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      image: true,
      role: true,
    },
  });
  return user;
});

/** Any signed-in user. Redirects to sign-in otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** The owner only. Everyone else is sent to their own workspace. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homePathFor(user.role));
  return user;
}

/** Managers only. */
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect(homePathFor(user.role));
  return user;
}

/** HR only. */
export async function requireHR(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "HR") redirect(homePathFor(user.role));
  return user;
}

/** Anyone who leads people: the owner, HR or a manager. */
export async function requireLead(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role === "MEMBER") redirect(homePathFor(user.role));
  return user;
}

/** Employees only. */
export async function requireEmployee(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "MEMBER") redirect(homePathFor(user.role));
  return user;
}

/** Anyone who can be assigned work: a manager or an employee (never the owner). */
export async function requireAssignee(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect(homePathFor(user.role));
  return user;
}

/** For sign-in / sign-up: someone already signed in goes to their dashboard. */
export async function redirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
}

export function homePathFor(role: Role) {
  return HOME_PATHS[role];
}
