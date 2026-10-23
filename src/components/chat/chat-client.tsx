"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPicker } from "@/components/attachments/attachment-picker";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteChatMessageAction, markChatReadAction, openChatAction, sendChatMessageAction } from "@/server/actions/chat";
import type { listChatPeople, listChats } from "@/server/chat";

export function ChatDirectory({ people, chats, base, selected }: {
  people: Awaited<ReturnType<typeof listChatPeople>>;
  chats: Awaited<ReturnType<typeof listChats>>;
  base: string;
  selected?: string;
}) {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const existing = new Set(chats.map((c) => c.person.id));
  const entries = [
    ...chats.map((c) => ({ person: c.person, chatId: c.id, preview: c.preview, unread: c.unread })),
    ...people.filter((p) => !existing.has(p.id)).map((person) => ({ person, chatId: undefined, preview: "Start a conversation", unread: false })),
  ].filter((entry) => entry.person.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  function open(personId: string) {
    startTransition(async () => {
      try {
        const result = await openChatAction(personId);
        if (!result.ok) return void toast.error(result.error);
        router.push(`${base}/chat?thread=${encodeURIComponent(result.data.id)}`);
      } catch { toast.error("Couldn't open this chat. Check your connection and try again."); }
    });
  }
  return <aside className={`min-w-0 rounded-xl border bg-card lg:w-72 lg:shrink-0 ${selected ? "hidden lg:block" : ""}`}>
    <div className="border-b p-4"><h2 className="mb-3 font-semibold">People & conversations</h2><label className="flex items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring"><Search className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Search employees" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 min-w-0 w-full bg-transparent text-sm outline-none" /></label></div>
    <ul className="max-h-64 overflow-y-auto p-2 lg:max-h-[65vh]">
      {entries.map((entry) => {
        const content = <><UserAvatar id={entry.person.id} name={entry.person.name} image={entry.person.image} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{entry.person.name}{entry.person.deletedAt ? " (Deleted)" : ""}</span><span className="block truncate text-xs text-muted-foreground">{entry.preview}</span></span>{entry.unread && <span className="size-2 shrink-0 rounded-full bg-sun-deep" aria-label="Unread messages" />}</>;
        const style = `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${selected && entry.chatId === selected ? "bg-sun-soft text-foreground" : "hover:bg-muted"}`;
        return <li key={entry.person.id}>{entry.chatId ? <Link href={`${base}/chat?thread=${encodeURIComponent(entry.chatId)}`} aria-current={entry.chatId === selected ? "page" : undefined} className={style}>{content}</Link> : <button type="button" disabled={pending} onClick={() => open(entry.person.id)} className={style}>{content}</button>}</li>;
      })}
      {!entries.length && <li className="px-3 py-8 text-center text-sm text-muted-foreground">{search ? "No employees match this name." : "No other employees yet."}</li>}
    </ul>
    {pending && <p role="status" className="px-4 pb-3 text-sm text-muted-foreground">Opening chat…</p>}
  </aside>;
}

export function ChatComposer({ chatId }: { chatId: string }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState({ ids: [] as string[], busy: false });
  const [key, setKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const canSend = !pending && !files.busy && (!!body.trim() || !!files.ids.length);
  function send() {
    if (!canSend) return;
    startTransition(async () => {
      try {
        const result = await sendChatMessageAction(chatId, { body, attachmentIds: files.ids });
        if (!result.ok) { setError(result.error); return; }
        setBody(""); setError(""); setKey((k) => k + 1);
      } catch { setError("Message couldn't be sent. Check your connection and try again."); }
    });
  }
  return <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-3 border-t p-4">
    <label htmlFor="chat-message" className="sr-only">Message</label>
    <Textarea id="chat-message" placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={3} disabled={pending} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
    <AttachmentPicker key={key} allowFiles onChange={setFiles} disabled={pending} hint="Photos up to 10 MB, videos up to 50 MB, documents up to 25 MB. Up to 6 files." />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Only you and this person can read this chat.</p><Button variant="brand" type="submit" disabled={!canSend}>{pending || files.busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}{files.busy ? "Uploading…" : pending ? "Sending…" : "Send message"}</Button></div>
  </form>;
}

export function ChatReadMarker({ chatId, through, lastId, scroll }: { chatId: string; through: string | null; lastId?: string; scroll: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mark = () => {
      if (through && document.visibilityState === "visible") void markChatReadAction(chatId, through).catch(() => {});
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [chatId, through]);
  useEffect(() => { if (scroll) end.current?.scrollIntoView({ block: "nearest" }); }, [lastId, scroll]);
  return <div ref={end} />;
}

export function DeleteChatMessage({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} aria-label="Delete message" title="Delete within five minutes" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring" onClick={() => startTransition(async () => {
    try {
      const result = await deleteChatMessageAction(id);
      if (!result.ok) toast.error(result.error);
    } catch { toast.error("Couldn't delete the message. Try again."); }
  })}>{pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}</button>;
}
