"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { idSchema, messageSchema } from "@/lib/validation";
import { requireUser } from "@/server/session";
import * as chat from "@/server/chat";
import { run } from "./result";

export async function openChatAction(personId: unknown) {
  const user = await requireUser();
  const id = idSchema.safeParse(personId);
  if (!id.success) return { ok: false as const, error: "Choose an employee." };
  return run(() => chat.openChat(user, id.data));
}

export async function sendChatMessageAction(chatId: unknown, input: unknown) {
  const user = await requireUser();
  const id = idSchema.safeParse(chatId);
  const parsed = messageSchema.safeParse(input);
  if (!id.success || !parsed.success) return { ok: false as const, error: "Write a message or attach a file (up to 5,000 characters and six files)." };
  const result = await run(() => chat.sendChatMessage(user, id.data, parsed.data));
  if (result.ok) refresh();
  return result;
}

export async function markChatReadAction(chatId: unknown, through: unknown) {
  const user = await requireUser();
  const parsed = z.object({ id: idSchema, through: z.iso.datetime() }).safeParse({ id: chatId, through });
  if (!parsed.success) return { ok: false as const, error: "Invalid read marker." };
  return run(() => chat.markChatRead(user, parsed.data.id, new Date(parsed.data.through)));
}

export async function deleteChatMessageAction(messageId: unknown) {
  const user = await requireUser();
  const id = idSchema.safeParse(messageId);
  if (!id.success) return { ok: false as const, error: "Message not found." };
  const result = await run(() => chat.deleteChatMessage(user, id.data));
  if (result.ok) refresh();
  return result;
}
