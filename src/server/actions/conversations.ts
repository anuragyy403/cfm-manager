"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import {
  type ActionResult,
  caseSchema,
  caseStatusSchema,
  fieldErrorsOf,
  idSchema,
  messageSchema,
  reportSchema,
} from "@/lib/validation";
import * as conversations from "@/server/conversations";
import { notifyConversation } from "@/server/push";
import { requireHR, requireOwner, requireUser } from "@/server/session";
import { run } from "./result";

/**
 * Server Actions for private conversations with the owner ("Talk to the
 * owner" cases and HR's desk). Who may see and do what is enforced in
 * `src/server/conversations.ts`.
 */

const INVALID_FIELDS = "Check the highlighted fields.";

export async function raiseCaseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = caseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => conversations.raiseCase(user, parsed.data));
  if (!res.ok) return res;
  after(() => notifyConversation(res.data.id, user, "case"));
  return { ok: true, data: { id: res.data.id } };
}

export async function sendMessageAction(conversationId: unknown, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(conversationId);
  const parsed = messageSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid conversation." };
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => conversations.postMessage(user, id.data, parsed.data));
  if (!res.ok) return res;
  after(() => notifyConversation(id.data, user, "message"));
  refresh();
  return { ok: true };
}

export async function deleteMessageAction(messageId: unknown): Promise<ActionResult<{ withdrawn: boolean }>> {
  const user = await requireUser();
  const id = idSchema.safeParse(messageId);
  if (!id.success) return { ok: false, error: "Invalid message." };
  const res = await run(() => conversations.deleteMessage(user, id.data));
  if (!res.ok) return res;
  refresh();
  return res;
}

export async function markReadAction(conversationId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(conversationId);
  if (!id.success) return { ok: false, error: "Invalid conversation." };
  const res = await run(() => conversations.markRead(user, id.data));
  if (!res.ok) return res;
  // Refreshes the sidebar's unread badge too.
  refresh();
  return { ok: true };
}

export async function setCaseStatusAction(conversationId: unknown, status: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const id = idSchema.safeParse(conversationId);
  const parsed = caseStatusSchema.safeParse(status);
  if (!id.success || !parsed.success) return { ok: false, error: "Invalid request." };
  const res = await run(() => conversations.setCaseStatus(owner, id.data, parsed.data));
  if (!res.ok) return res;
  const event = parsed.data === "RESOLVED" ? "resolved" : res.data.previous === "RESOLVED" ? "reopened" : null;
  if (event) after(() => notifyConversation(id.data, owner, event));
  refresh();
  return { ok: true };
}

export async function sendReportAction(input: unknown): Promise<ActionResult> {
  const hr = await requireHR();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
  const res = await run(() => conversations.sendReport(hr, parsed.data));
  if (!res.ok) return res;
  after(() => notifyConversation(res.data.conversationId, hr, "report"));
  refresh();
  return { ok: true };
}
