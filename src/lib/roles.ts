/**
 * Role names as people in the office use them. The database keeps the
 * original values: ADMIN is the company owner, MEMBER is an employee.
 */
export type AppRole = "ADMIN" | "MANAGER" | "MEMBER";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Owner",
  MANAGER: "Manager",
  MEMBER: "Employee",
};

export const WORKSPACE_LABELS: Record<AppRole, string> = {
  ADMIN: "Owner workspace",
  MANAGER: "Manager workspace",
  MEMBER: "My workspace",
};

/** Base path of each role's workspace. */
export const HOME_PATHS: Record<AppRole, string> = {
  ADMIN: "/admin",
  MANAGER: "/manager",
  MEMBER: "/dashboard",
};
