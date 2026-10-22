"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPicker } from "@/components/attachments/attachment-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessageAction } from "@/server/actions/conversations";
import { useReply } from "./thread-client";

/** Writes a message: text, photos or videos, optionally replying to one message. */
export function Composer({
  conversationId,
  placeholder = "Write a message…",
  privacyNote,
}: {
  conversationId: string;
  placeholder?: string;
  /** Shown under the box, e.g. "Only you and the owner can see this." */
  privacyNote?: string;
}) {
  const { replyTo, setReplyTo } = useReply();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState({ ids: [] as string[], busy: false });
  // Remounting the picker clears it after sending.
  const [pickerKey, setPickerKey] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const canSend = (body.trim().length > 0 || files.ids.length > 0) && !files.busy && !pending;

  function send() {
    if (!canSend) return;
    startTransition(async () => {
      const res = await sendMessageAction(conversationId, {
        body,
        attachmentIds: files.ids,
        replyToId: replyTo?.id,
      });
      if (!res.ok) {
        setError(res.fieldErrors?.body ?? res.error);
        toast.error(res.fieldErrors?.body ?? res.error);
        return;
      }
      setError(undefined);
      setBody("");
      setReplyTo(null);
      setPickerKey((k) => k + 1);
    });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {replyTo && (
        <div className="flex items-start gap-2 rounded-lg border-l-4 border-l-sun bg-muted/60 px-3 py-2 text-sm">
          <p className="min-w-0 flex-1 truncate text-muted-foreground">
            Replying to <span className="font-medium text-foreground">{replyTo.label}</span>
          </p>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <Textarea
        id="composer-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter sends; Enter alone makes a new line (long messages are common here).
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={3}
        maxLength={5000}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-label="Message"
        className="bg-card"
      />
      <AttachmentPicker key={pickerKey} onChange={setFiles} disabled={pending} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        {privacyNote ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            {privacyNote}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" variant="brand" disabled={!canSend}>
          {pending || files.busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          {files.busy ? "Uploading…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
