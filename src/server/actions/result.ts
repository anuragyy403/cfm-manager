import "server-only";
import type { ActionResult } from "@/lib/validation";
import { DomainError } from "@/server/access";

/** Runs a data-access call, turning a DomainError into a friendly failed result. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data } as ActionResult<T>;
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}
