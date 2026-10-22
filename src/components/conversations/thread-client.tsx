"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MESSAGE_DELETE_WINDOW_MS } from "@/lib/conversations";
import { deleteMessageAction, markReadAction } from "@/server/actions/conversations";

/** The message the composer is replying to, set by "Reply" buttons in the thread. */
export type ReplyTarget = { id: string; label: string };

const ReplyContext = createContext<{
  replyTo: ReplyTarget | null;
  setReplyTo: (target: ReplyTarget | null) => void;
}>({ replyTo: null, setReplyTo: () => {} });

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  return <ReplyContext.Provider value={{ replyTo, setReplyTo }}>{children}</ReplyContext.Provider>;
}

export function useReply() {
  return useContext(ReplyContext);
}

export function ReplyButton({ target }: { target: ReplyTarget }) {
  const { setReplyTo } = useReply();
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={() => {
        setReplyTo(target);
        document.getElementById("composer-body")?.focus();
      }}
    >
      <Reply />
      Reply
    </Button>
  );
}

/**
 * Marks the conversation read while it's on screen: on opening, and again
 * whenever a new message arrives (the page refreshes itself).
 */
export function MarkRead({ conversationId, lastMessageAt }: { conversationId: string; lastMessageAt: string }) {
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState === "visible") void markReadAction(conversationId);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [conversationId, lastMessageAt]);
  return null;
}

/**
 * "Delete" on your own message, shown only during the first 5 minutes after
 * sending (the server checks the time again).
 */
export function DeleteMessageButton({
  messageId,
  createdAt,
  withdrawsCase,
}: {
  messageId: string;
  createdAt: string;
  /** Deleting the first message of a case withdraws the case. */
  withdrawsCase: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const left = new Date(createdAt).getTime() + MESSAGE_DELETE_WINDOW_MS - Date.now();
    const id = window.setTimeout(() => setExpired(true), Math.max(0, left));
    return () => window.clearTimeout(id);
  }, [createdAt]);

  if (expired) return null;

  function remove() {
    startTransition(async () => {
      const res = await deleteMessageAction(messageId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.withdrawn ? "Concern withdrawn" : "Message deleted");
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{withdrawsCase ? "Withdraw the whole concern?" : "Delete it?"}</span>
        <Button type="button" variant="destructive" size="xs" onClick={remove} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {withdrawsCase ? "Withdraw" : "Delete"}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => setConfirming(false)} disabled={pending}>
          Keep
        </Button>
      </span>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={() => setConfirming(true)}
      title="You can delete a message in the first 5 minutes after sending it"
    >
      <Trash2 />
      Delete
    </Button>
  );
}

/**
 * The scrolling message area. Opens at the newest message, and follows new
 * ones as they arrive unless you've scrolled up to read older ones.
 */
export function ThreadScroller({ count, children }: { count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || !pinned.current) return;
    // A link to one message (#m-…) wins over jumping to the end.
    const target = window.location.hash.startsWith("#m-") ? el.querySelector(window.location.hash) : null;
    if (target) target.scrollIntoView({ block: "center" });
    else el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="max-h-[62dvh] min-h-48 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
    >
      {children}
    </div>
  );
}
