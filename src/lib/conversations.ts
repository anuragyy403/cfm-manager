/**
 * Labels and rules for private conversations with the owner ("Talk to the
 * owner" cases and HR's desk), shared by the server and the browser.
 */

export type CaseStatus = "OPEN" | "IN_DISCUSSION" | "RESOLVED" | "WITHDRAWN";
export type CaseCategory = "COLLEAGUE" | "MANAGER" | "WORKLOAD" | "CONDUCT" | "OTHER";
export type CaseUrgency = "NORMAL" | "URGENT";

export const CASE_CATEGORIES = ["COLLEAGUE", "MANAGER", "WORKLOAD", "CONDUCT", "OTHER"] as const;

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  COLLEAGUE: "Problem with a colleague",
  MANAGER: "Problem with my manager",
  WORKLOAD: "Workload or deadlines",
  CONDUCT: "Behaviour or conduct",
  OTHER: "Something else",
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "Waiting for the owner",
  IN_DISCUSSION: "In discussion",
  RESOLVED: "Resolved",
  WITHDRAWN: "Withdrawn",
};

/** The sender can take a message back for this long after sending it. */
export const MESSAGE_DELETE_WINDOW_MS = 5 * 60 * 1000;

export function canStillDelete(createdAt: Date, now = Date.now()) {
  return now - createdAt.getTime() < MESSAGE_DELETE_WINDOW_MS;
}

/**
 * Whether a conversation has something the viewer hasn't read: the last
 * message is someone else's and came after they last opened it.
 */
export function isUnread(
  convo: { lastMessageAt: Date; lastMessageAuthorId: string | null },
  viewerId: string,
  lastReadAt: Date | null | undefined,
) {
  if (!convo.lastMessageAuthorId || convo.lastMessageAuthorId === viewerId) return false;
  return !lastReadAt || lastReadAt < convo.lastMessageAt;
}
