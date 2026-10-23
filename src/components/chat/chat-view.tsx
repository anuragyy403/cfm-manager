import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import { ChatComposer, ChatDirectory, ChatReadMarker, DeleteChatMessage } from "@/components/chat/chat-client";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { canStillDelete } from "@/lib/conversations";
import { getChat, listChatPeople, listChats } from "@/server/chat";
import type { CurrentUser } from "@/server/session";

export async function ChatView({ viewer, base, searchParams }: { viewer: CurrentUser; base: string; searchParams: Record<string, string | string[] | undefined> }) {
  const id = typeof searchParams.thread === "string" ? searchParams.thread : undefined;
  const before = typeof searchParams.before === "string" ? searchParams.before : undefined;
  const [people, chats, chat] = await Promise.all([listChatPeople(viewer), listChats(viewer), id ? getChat(viewer, id, before) : null]);
  if (id && !chat) notFound();
  return <div className="employee-chat">
    <PageHeader title="Employee chat" description="Talk with anyone in the company. Share updates, photos, documents, and videos." />
    <AutoRefresh intervalMs={5000} />
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <ChatDirectory people={people} chats={chats} base={base} selected={id} />
      <section aria-label={chat ? `Chat with ${chat.person.name}` : "Conversation"} className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
        {!chat ? <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center"><MessageSquare className="size-10 text-sun-deep" /><h2 className="text-xl font-semibold">Start a conversation</h2><p className="max-w-sm text-sm text-muted-foreground">Choose an employee from the directory to send a message or share a file. Owner cases and HR reports stay in their own private sections.</p></div> : <>
          <header className="flex items-center gap-3 border-b px-5 py-4"><Link href={`${base}/chat`} aria-label="Back to people and conversations" className="rounded-lg p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:hidden"><ArrowLeft className="size-5" /></Link><UserAvatar id={chat.person.id} name={chat.person.name} image={chat.person.image} /><div><h2 className="font-semibold">{chat.person.name}</h2><p className="text-xs text-muted-foreground">{chat.person.deletedAt ? "Account deleted · conversation kept on record" : "Direct conversation · messages update automatically"}</p></div></header>
          <div className="h-[36dvh] min-h-48 space-y-4 overflow-y-auto overscroll-contain p-4 sm:h-[50vh] sm:min-h-72 sm:p-6">
            <div className="flex flex-wrap justify-center gap-2">{chat.hasOlder && <Button asChild variant="outline" size="sm"><Link href={`${base}/chat?thread=${chat.id}&before=${chat.messages[0]!.id}`}>Older messages</Link></Button>}{before && <Button asChild variant="outline" size="sm"><Link href={`${base}/chat?thread=${chat.id}`}>Latest messages</Link></Button>}</div>
            {!chat.messages.length && <p className="py-12 text-center text-sm text-muted-foreground">No messages yet. Say hello to {chat.person.name.split(" ")[0]}.</p>}
            <ol aria-label="Messages" className="space-y-4">{chat.messages.map((message) => {
              const mine = message.authorId === viewer.id;
              return <li key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] space-y-2 rounded-xl px-4 py-3 sm:max-w-[80%] ${mine ? "bg-sun-soft" : "bg-muted"}`}><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-xs font-semibold">{mine ? "You" : message.author.name}</span><time dateTime={message.createdAt.toISOString()} className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</time>{mine && !message.deletedAt && canStillDelete(message.createdAt) && <DeleteChatMessage id={message.id} />}</div>{message.deletedAt ? <p className="text-sm italic text-muted-foreground">This message was deleted.</p> : <>{message.body && <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{message.body}</p>}<AttachmentGallery attachments={message.attachments} /></>}</div></li>;
            })}</ol>
            <ChatReadMarker chatId={chat.id} through={before ? null : chat.readThrough?.toISOString() ?? null} lastId={chat.messages.at(-1)?.id} scroll={!before} />
          </div>
          {chat.person.deletedAt ? <p className="border-t p-5 text-sm text-muted-foreground">You can read this history, but this account cannot receive new messages.</p> : <ChatComposer key={chat.id} chatId={chat.id} />}
        </>}
      </section>
    </div>
  </div>;
}
