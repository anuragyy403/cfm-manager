/**
 * Role names as people in the office use them. The database keeps the
 * original values: ADMIN is the company owner, MEMBER is an employee.
 *
 * Hierarchy: Owner → HR → Manager → Employee. HR works across every team.
 */
export type AppRole = "ADMIN" | "HR" | "MANAGER" | "MEMBER";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Owner",
  HR: "HR",
  MANAGER: "Manager",
  MEMBER: "Employee",
};

export const WORKSPACE_LABELS: Record<AppRole, string> = {
  ADMIN: "Owner workspace",
  HR: "HR workspace",
  MANAGER: "Manager workspace",
  MEMBER: "My workspace",
};

/** Base path of each role's workspace. */
export const HOME_PATHS: Record<AppRole, string> = {
  ADMIN: "/admin",
  HR: "/hr",
  MANAGER: "/manager",
  MEMBER: "/dashboard",
};

/**
 * Roles that can head a team and be given work as its head: managers, and HR
 * (who heads the HR team the owner assigns HR's own work to). Never the owner.
 */
export function headsTeamAsAssignee(role: AppRole) {
  return role === "MANAGER" || role === "HR";
}
