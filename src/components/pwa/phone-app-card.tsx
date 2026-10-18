"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, CheckCircle2, Download, Loader2, RefreshCw, Share, SquarePlus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sendTestPushAction } from "@/server/actions/push";
import { deviceKind, type DeviceKind, usePush, useInstall } from "./pwa";

/** Account settings card: install the app and turn notifications on for this device. */
export function PhoneAppCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange-soft text-sun-deep">
          <Smartphone className="size-[18px]" />
        </span>
        <div className="grid gap-1">
          <CardTitle>Phone app &amp; notifications</CardTitle>
          <CardDescription>
            Add CFM Workplace to your home screen and get a notification when a task is given to you or a task you
            assigned is completed.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <InstallSection />
        <NotificationSection />
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium">{children}</h3>;
}

function InstallSection() {
  const { ready, installed, ios, canPrompt, install } = useInstall();
  if (!ready) return null;

  return (
    <section className="grid gap-2">
      <SectionTitle>Install the app</SectionTitle>
      {installed ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-emerald-600" /> You&apos;re using the installed app.
        </p>
      ) : canPrompt ? (
        <div>
          <Button
            onClick={async () => {
              if (await install()) toast.success("CFM Workplace is on your home screen");
            }}
          >
            <Download /> Install app
          </Button>
        </div>
      ) : ios ? (
        <ol className="grid gap-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Step n={1} /> Open this page in <span className="font-medium text-foreground">Safari</span>.
          </li>
          <li className="flex items-center gap-2">
            <Step n={2} /> Tap <Share className="size-4 text-foreground" aria-label="Share" />
            <span className="font-medium text-foreground">Share</span> at the bottom of the screen.
          </li>
          <li className="flex items-center gap-2">
            <Step n={3} /> Choose <SquarePlus className="size-4 text-foreground" aria-hidden />
            <span className="font-medium text-foreground">Add to Home Screen</span>, then
            <span className="font-medium text-foreground">Add</span>.
          </li>
          <li className="flex items-center gap-2">
            <Step n={4} /> Open CFM Workplace from your home screen and turn on notifications below.
          </li>
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          On your phone, open this site in Chrome, tap the <span className="font-medium text-foreground">⋮</span> menu
          and choose <span className="font-medium text-foreground">Install app</span> (or{" "}
          <span className="font-medium text-foreground">Add to Home screen</span>).
        </p>
      )}
    </section>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
      {n}
    </span>
  );
}

function NotificationSection() {
  const { state, busy, enable, disable, recheck } = usePush();
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);

  async function turnOn() {
    try {
      if (await enable()) toast.success("Notifications are on for this device");
      else if (Notification.permission === "default") {
        toast.info("Notifications weren't allowed. Tap Turn on again and choose Allow.");
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Could not turn on notifications.");
    }
  }

  async function checkAgain() {
    setChecking(true);
    const next = await recheck();
    setChecking(false);
    if (next === "on") toast.success("Notifications are on for this device");
    else if (next === "off") await turnOn();
    else toast.error("Still blocked. Follow the steps above, then come back to this page.");
  }

  async function sendTest() {
    setTesting(true);
    const res = await sendTestPushAction();
    setTesting(false);
    if (res.ok) toast.success("Test sent. It should appear in a few seconds.");
    else toast.error(res.error);
  }

  return (
    <section id="notifications" className="grid scroll-mt-24 gap-2">
      <SectionTitle>Notifications on this device</SectionTitle>
      {state === "loading" ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : state === "unsupported" ? (
        <p className="text-sm text-muted-foreground">This browser can&apos;t show notifications. Try Chrome, Edge, Safari or Firefox.</p>
      ) : state === "needs-install" ? (
        <p className="text-sm text-muted-foreground">
          On iPhone, notifications work once CFM Workplace is on your home screen (iOS 16.4 or newer). Follow the
          steps above, then open it from the home screen.
        </p>
      ) : state === "denied" ? (
        <div className="grid gap-3">
          <Alert>
            <BellOff />
            <AlertDescription>
              Notifications are blocked on this device. For your safety, phones don&apos;t let an app switch them
              back on by itself. It takes a few seconds in settings:
            </AlertDescription>
          </Alert>
          <UnblockSteps />
          <p className="text-sm text-muted-foreground">
            When you come back here, notifications switch on by themselves.
          </p>
          <div>
            <Button onClick={checkAgain} disabled={checking || busy}>
              {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              I&apos;ve allowed it, check again
            </Button>
          </div>
        </div>
      ) : state === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 flex items-center gap-2 text-sm">
            <Bell className="size-4 text-emerald-600" /> Notifications are on.
          </p>
          <Button variant="outline" onClick={sendTest} disabled={testing || busy}>
            {testing && <Loader2 className="animate-spin" />}
            Send test notification
          </Button>
          <Button variant="ghost" onClick={disable} disabled={busy}>
            Turn off
          </Button>
        </div>
      ) : (
        <div>
          <Button onClick={turnOn} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Bell />}
            Turn on notifications
          </Button>
        </div>
      )}
    </section>
  );
}

const noSubscribe = () => () => {};

/** How to unblock notifications on this kind of device. */
function UnblockSteps() {
  const kind = useSyncExternalStore<DeviceKind | null>(noSubscribe, deviceKind, () => null);
  if (!kind) return null;
  const site = window.location.host;

  if (kind === "iphone-app" || kind === "iphone-browser") {
    return (
      <Steps
        steps={[
          <>Open the iPhone <B>Settings</B> app.</>,
          <>Tap <B>Notifications</B>, then <B>CFM Work</B>.</>,
          <>Turn on <B>Allow Notifications</B>.</>,
        ]}
      />
    );
  }

  if (kind === "computer") {
    return (
      <Steps
        steps={[
          <>Click the icon to the left of the web address (a padlock or sliders).</>,
          <>Find <B>Notifications</B> and choose <B>Allow</B>.</>,
          <>Come back to this tab.</>,
        ]}
      />
    );
  }

  const chromeSteps = [
    <>Open <B>Chrome</B>, tap <B>⋮</B> → <B>Settings</B> → <B>Site settings</B> → <B>Notifications</B>.</>,
    <>Under <B>Blocked</B>, tap <B>{site}</B> and choose <B>Allow</B>.</>,
  ];
  const chromeTip = (
    <p className="text-xs text-muted-foreground">
      Still blocked? In your phone&apos;s <B>Settings</B> → <B>Apps</B> → <B>Chrome</B> → <B>Notifications</B>, make
      sure notifications are on.
    </p>
  );

  if (kind === "android-browser") {
    return (
      <div className="grid gap-3">
        <Steps
          steps={[
            <>Tap the icon to the left of the web address.</>,
            <>Tap <B>Permissions</B> (or <B>Site settings</B>) → <B>Notifications</B> → <B>Allow</B>.</>,
          ]}
        />
        {chromeTip}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <Steps
        steps={[
          <>Go to your home screen and <B>press and hold</B> the CFM Work icon.</>,
          <>Tap <B>App info</B> (the ⓘ icon).</>,
          <>Tap <B>Notifications</B> and turn on <B>Allow notifications</B>.</>,
        ]}
      />
      <p className="text-xs font-medium text-muted-foreground">No Notifications option there? Use Chrome instead:</p>
      <Steps steps={chromeSteps} />
      {chromeTip}
    </div>
  );
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="grid gap-2 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2">
          <Step n={i + 1} />
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}
