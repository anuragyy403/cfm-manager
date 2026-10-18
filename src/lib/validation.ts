import { z } from "zod";
import { TASK_PRIORITIES } from "@/lib/tasks/rules";

/** Shared by client forms and server actions; the server always re-validates. */

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters.").max(80),
  description: z.string().trim().max(300).optional().default(""),
  /** Owner only: who runs the team. Ignored for managers (they run what they create). */
  managerId: z.string().min(1).max(64).optional(),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(TASK_PRIORITIES),
  /** ISO timestamp produced by the browser from the local date/time picker. */
  dueAt: z.iso.datetime({ offset: true, error: "Choose a valid deadline." }),
  assigneeId: z.string().min(1, "Choose who this task is assigned to."),
  teamId: z.string().min(1, "Choose a team.").max(64),
  /** Set when splitting a bigger task into a subtask. */
  parentId: z.string().min(1).max(64).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

/** One task for every employee on a team. */
export const teamTaskInputSchema = taskInputSchema.omit({ assigneeId: true, parentId: true });

/** Editing never moves a task to another team or parent. */
export const taskUpdateSchema = taskInputSchema.omit({ teamId: true, parentId: true });
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const roleChangeSchema = z.enum(["MANAGER", "MEMBER"]);

export const completionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Add a short completion note (at least 5 characters).")
    .max(2000),
});

/** A reviewer's verdict. Feedback is optional when passing, required when failing. */
export const reviewSchema = z
  .object({
    decision: z.enum(["PASS", "FAIL"]),
    note: z.string().trim().max(2000).optional().default(""),
  })
  .refine((v) => v.decision === "PASS" || v.note.length >= 5, {
    path: ["note"],
    message: "Tell them what needs to change (at least 5 characters).",
  })
  .transform((v) => ({ decision: v.decision, note: v.note || null }));

export const reopenSchema = z.object({
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters).").max(1000),
});

export const idSchema = z.string().min(1).max(64);

// ─── Account ────────────────────────────────────────────────────────────────

/** Matches Better Auth's limits (min 8 set in `src/lib/auth.ts`, max 128 default). */
export const passwordSchema = z.string().min(8, "At least 8 characters.").max(128, "At most 128 characters.");

export const newPasswordSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current one.",
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "At most 80 characters."),
});

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Turns a Zod error into `{ field: firstMessage }`. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
