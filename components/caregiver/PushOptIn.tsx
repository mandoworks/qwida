"use client";

import { useEffect, useState } from "react";
import { BigButton } from "@/components/ui/BigButton";
import type { StringKey } from "@/lib/weekcard/strings";
import { Bell } from "./icons";
import { useLang } from "./lang-context";

type State =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on"
  | "no-keys"
  | "error";

/** iOS only delivers web push to an app that was added to the home screen. */
function installedAsApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * What this browser can do right now. Read on mount and after every change: the
 * permission, the installed app and the saved subscription are all outside React.
 */
async function readState(): Promise<State> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (isIos() && !installedAsApp()) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSubscription().catch(() => null);
  if (sub) return "on";
  const res = await fetch("/api/push/subscribe").catch(() => null);
  const data = res?.ok ? ((await res.json()) as { publicKey: string | null }) : null;
  return data?.publicKey ? "off" : "no-keys";
}

/**
 * Opt in for caregiver alerts on this phone. Real web push: one alert per thing
 * Doña Carmen sent, delivered by the browser even when this tab is in the
 * background. Nothing is ever sent to Doña Carmen herself.
 */
export function PushOptIn() {
  const { t } = useLang();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let live = true;
    void readState().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/subscribe");
      const data = (await res.json()) as { publicKey: string | null };
      if (!data.publicKey) return setState("no-keys");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        }));
      const saved = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState(saved.ok ? "on" : "error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setSent(false);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setSent(res.ok);
    } finally {
      setBusy(false);
    }
  }

  const message: Record<Exclude<State, "checking">, StringKey> = {
    unsupported: "push.unsupported",
    "needs-install": "push.needsInstall",
    denied: "push.denied",
    off: "push.hint",
    on: "push.on",
    "no-keys": "push.noKeys",
    error: "push.error",
  };

  if (state === "checking") return null;

  const canToggle = state === "off" || state === "on" || state === "error";

  return (
    <fieldset className="flex flex-col gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
      <legend className="flex items-center gap-2 text-c-title font-bold">
        {t("push.title")}
      </legend>
      <p className="text-c-meta text-ink-mute">{t(message[state])}</p>
      {canToggle && (
        <div className="flex flex-wrap gap-2">
          {state === "on" ? (
            <>
              <BigButton
                variant="secondary"
                onClick={sendTest}
                disabled={busy}
                className="min-h-tap-c-lg text-c-body"
                icon={<Bell size={20} />}
              >
                {t("push.test")}
              </BigButton>
              <BigButton variant="secondary" onClick={disable} disabled={busy} className="min-h-tap-c-lg text-c-body">
                {t("push.disable")}
              </BigButton>
            </>
          ) : (
            <BigButton
              onClick={enable}
              disabled={busy}
              className="min-h-tap-c-lg text-c-body"
              icon={<Bell size={20} />}
            >
              {t("push.enable")}
            </BigButton>
          )}
        </div>
      )}
      {sent && (
        <p role="status" className="rounded-well bg-sand px-3 py-2 text-c-meta text-ink-mute">
          {t("push.testSent")}
        </p>
      )}
    </fieldset>
  );
}
