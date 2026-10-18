"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/server/actions/push";

/**
 * Browser side of the phone app: installing to the home screen and turning
 * notifications on or off for this device.
 */

// ─── Install ────────────────────────────────────────────────────────────────

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let installPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((fn) => fn());

/**
 * Chrome and Edge fire `beforeinstallprompt` once, early. Keep it so the
 * "Install app" button works on whichever page the person opens later.
 */
export function listenForInstallPrompt() {
  const onPrompt = (e: Event) => {
    e.preventDefault();
    installPrompt = e as InstallPromptEvent;
    notifyInstall();
  };
  const onInstalled = () => {
    installPrompt = null;
    notifyInstall();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

function subscribeInstall(fn: () => void) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Running from the home screen (not in a browser tab). */
export function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribeInstall, () => installPrompt !== null, () => false);
  // Unknown (null) while rendering on the server.
  const installed = useSyncExternalStore(noSubscribe, isInstalled, () => null);
  const ios = useSyncExternalStore(noSubscribe, isIOS, () => false);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    notifyInstall();
    return outcome === "accepted";
  }, []);

  return { ready: installed !== null, installed: installed ?? false, ios, canPrompt, install };
}

const noSubscribe = () => () => {};

// ─── Notifications ──────────────────────────────────────────────────────────

/**
 * - `needs-install`: iPhone in a Safari tab; Apple only allows notifications
 *   for apps added to the home screen.
 * - `denied`: the person blocked notifications in the browser settings.
 */
export type PushState = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

/** Set when someone turns notifications off here, so we don't turn them back on by ourselves. */
const OPTED_OUT_KEY = "cfm-push-off";
const CHANGE_EVENT = "cfm-push-change";

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // Private mode or blocked storage: nothing to remember.
  }
}

function supportsPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function vapidKey() {
  const base64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

let subscribing: Promise<void> | null = null;

/** Subscribes this device and stores it for the signed-in person. Overlapping calls share one run. */
function subscribeDevice() {
  subscribing ??= doSubscribe().finally(() => (subscribing = null));
  return subscribing;
}

async function doSubscribe() {
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() }));
  const res = await savePushSubscriptionAction(sub.toJSON());
  if (!res.ok) {
    await sub.unsubscribe();
    throw new Error(res.error);
  }
}

/** Stops notifications on this device. Used on sign-out too, so the next person here doesn't get them. */
export async function unsubscribeDevice() {
  if (!supportsPush()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscriptionAction(sub.endpoint);
  await sub.unsubscribe();
}

async function currentState(): Promise<PushState> {
  if (!supportsPush()) return isIOS() && !isInstalled() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ? "on" : "off";
}

/**
 * Notification state for this device, plus on/off controls. With `sync`, it
 * also keeps the server's record current: if notifications are allowed and
 * the person hasn't turned them off here, the device is (re)subscribed for
 * whoever is signed in. Use `sync` in one place only (the app shell).
 */
export function usePush({ sync = false } = {}) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const shown = useRef<PushState>("loading");

  const update = useCallback((next: PushState) => {
    shown.current = next;
    setState(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }, []);

  /**
   * Re-reads the browser's permission. When notifications have just been
   * allowed (e.g. the person unblocked them in settings and came back), the
   * device is subscribed straight away, with no reload or second tap.
   */
  const recheck = useCallback(
    async ({ refreshServer = false } = {}) => {
      let next = await currentState();
      const allowed = supportsPush() && Notification.permission === "granted" && !readFlag(OPTED_OUT_KEY);
      // Also re-save when they were just blocked or off: the browser may still
      // hold an old subscription the server no longer has.
      const justAllowed = shown.current !== "on" && shown.current !== "loading";
      if (allowed && (next !== "on" || refreshServer || justAllowed)) {
        try {
          await subscribeDevice();
          next = "on";
        } catch (e) {
          console.error("Could not turn on notifications", e);
        }
      }
      update(next);
      return next;
    },
    [update],
  );

  useEffect(() => {
    let cancelled = false;
    // The app shell also re-saves the device on load, so the server always
    // knows who is signed in on it.
    Promise.resolve()
      .then(() => recheck({ refreshServer: sync }))
      .catch(() => !cancelled && setState("unsupported"));

    // Keep every copy of the switch (banner, account page) in step.
    const onChange = (e: Event) => {
      shown.current = (e as CustomEvent<PushState>).detail;
      setState(shown.current);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    const stopWatching = sync ? watchPermission(() => void recheck()) : () => {};
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, onChange);
      stopWatching();
    };
  }, [sync, recheck]);

  /** Must be called from a tap: browsers only show the permission prompt then. */
  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        update(permission === "denied" ? "denied" : "off");
        return false;
      }
      await subscribeDevice();
      writeFlag(OPTED_OUT_KEY, false);
      update("on");
      return true;
    } finally {
      setBusy(false);
    }
  }, [update]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeDevice();
      writeFlag(OPTED_OUT_KEY, true);
      update("off");
    } finally {
      setBusy(false);
    }
  }, [update]);

  return { state, busy, enable, disable, recheck };
}

/**
 * Calls `onChange` when the notification permission may have changed: the
 * browser reports it directly where it can, and every time the person comes
 * back to the app (e.g. from the phone's settings).
 */
function watchPermission(onChange: () => void) {
  let status: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: "notifications" })
    .then((s) => {
      status = s;
      s.addEventListener("change", onChange);
    })
    .catch(() => {});
  const onVisible = () => document.visibilityState === "visible" && onChange();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    status?.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}

/** Which unblock instructions to show. */
export type DeviceKind = "android-app" | "android-browser" | "iphone-app" | "iphone-browser" | "computer";

export function deviceKind(): DeviceKind {
  const installed = isInstalled();
  if (isIOS()) return installed ? "iphone-app" : "iphone-browser";
  if (/Android/i.test(navigator.userAgent)) return installed ? "android-app" : "android-browser";
  return "computer";
}
