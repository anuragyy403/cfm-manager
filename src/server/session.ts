import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

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

/** Admins only. Members are sent to their own dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Team members only. Admins are sent to the admin dashboard. */
export async function requireMember(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "MEMBER") redirect("/admin");
  return user;
}

/** For sign-in / sign-up: someone already signed in goes to their dashboard. */
export async function redirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
}

export function homePathFor(role: Role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}
