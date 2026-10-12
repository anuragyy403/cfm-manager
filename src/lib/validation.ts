import { z } from "zod";
import { TASK_PRIORITIES } from "@/lib/tasks/rules";

/** Shared by client forms and server actions; the server always re-validates. */

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters.").max(80),
  description: z.string().trim().max(300).optional().default(""),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(TASK_PRIORITIES),
  /** ISO timestamp produced by the browser from the local date/time picker. */
  dueAt: z.iso.datetime({ offset: true, error: "Choose a valid deadline." }),
  assigneeId: z.string().min(1, "Choose who this task is assigned to."),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const completionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Add a short completion note (at least 5 characters).")
    .max(2000),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters).").max(1000),
});

export const idSchema = z.string().min(1).max(64);

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
