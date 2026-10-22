import { EyeOff, Lock, MessagesSquare, ShieldCheck } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import type { CurrentUser } from "@/server/session";
import { findOwner, listCaseSubjects, listMyCases } from "@/server/conversations";
import { CaseRow } from "../case-row";
import { RaiseCaseDialog } from "../raise-case-dialog";

/**
 * "Talk to the owner": anyone but the owner raises a private concern, e.g. a
 * problem between them and their manager or a colleague, and talks it
 * through with the owner.
 */
export async function TalkView({ viewer, base }: { viewer: CurrentUser; base: string }) {
  const [cases, people, owner] = await Promise.all([listMyCases(viewer), listCaseSubjects(viewer), findOwner()]);
  const ownerName = owner?.name ?? "the owner";

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Talk to the owner"
        description={`Having a problem with someone at work, or something you'd rather not raise in front of the team? Tell ${ownerName} directly and privately.`}
        actions={<RaiseCaseDialog people={people} base={base} />}
      />

      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        <Assurance icon={Lock} title="Private">
          Only you and {ownerName} can read it. Not HR, not your manager.
        </Assurance>
        <Assurance icon={EyeOff} title="Never shown to them">
          The person it&apos;s about is never told and can&apos;t see it.
        </Assurance>
        <Assurance icon={ShieldCheck} title="On record">
          Messages stay, so nothing gets lost. Sent something by mistake? Delete it within 5 minutes.
        </Assurance>
      </ul>

      <h2 className="mb-3 text-lg font-semibold">Your concerns</h2>
      {cases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-orange-soft text-sun-deep">
            <MessagesSquare className="size-6" />
          </span>
          <p className="mt-2 font-semibold">Nothing raised yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            When something&apos;s bothering you at work, use “Raise a concern”. You can add photos or videos, like
            screenshots of a chat.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {cases.map((c) => (
            <CaseRow key={c.id} row={c} href={`${base}/talk/${c.id}`} forOwner={false} />
          ))}
        </ul>
      )}
    </>
  );
}

function Assurance({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
