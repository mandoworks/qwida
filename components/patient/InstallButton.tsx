"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Art } from "@/components/ui/Art";
import { VoiceIcon } from "./Icons";
import { useLocalValue } from "./useLocalValue";

/** The browser install prompt event. Stashed on capture so the patient's tap can fire it. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Tiny external store for the deferred install prompt. useSyncExternalStore keeps
 * the component in sync without any setState inside effects (which breaks the
 * Vercel production lint).
 */
let bipEvent: BeforeInstallPromptEvent | null = null;
const bipListeners = new Set<() => void>();
function setBIP(e: BeforeInstallPromptEvent | null) {
  bipEvent = e;
  bipListeners.forEach((cb) => cb());
}
function subscribeBIP(cb: () => void) {
  const onBIP = (e: Event) => {
    e.preventDefault();
    setBIP(e as BeforeInstallPromptEvent);
  };
  window.addEventListener("beforeinstallprompt", onBIP);
  bipListeners.add(cb);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBIP);
    bipListeners.delete(cb);
  };
}
function getBIP() {
  return bipEvent;
}

const INSTALL_BTN =
  "flex min-h-[4.5rem] w-full items-center justify-center rounded-2xl border-[3px] border-ink bg-accent px-6 py-4 text-p-body font-bold text-accent-ink shadow-yari-btn transition-transform active:scale-[0.98]";

/**
 * Visible PWA install button for the patient, in Yari's art direction.
 * Android and Chrome: captures beforeinstallprompt and fires it on tap.
 * iPhone and iPad: Safari never fires the prompt, so friendly manual steps in Spanish.
 * Hidden when Qwida already runs installed, or after the patient dismisses it.
 */
export function InstallButton() {
  const [dismissed, setDismissed] = useLocalValue("quida.installButton");
  const promptEvent = useSyncExternalStore(subscribeBIP, getBIP, () => null);
  const ios = useSyncExternalStore(
    () => () => {},
    isIOS,
    () => false,
  );
  const standalone = useSyncExternalStore(
    () => () => {},
    isStandalone,
    () => true,
  );

  useEffect(() => {
    const onInstalled = () => setDismissed("1");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [setDismissed]);

  if (standalone || dismissed !== null) return null;

  const dismiss = () => setDismissed("1");

  const dismissRow = (
    <button
      type="button"
      onClick={dismiss}
      className="mt-2 inline-flex min-h-[3rem] items-center px-4 text-p-body text-ink-mute underline underline-offset-4"
    >
      Ahora no
    </button>
  );

  // iPhone and iPad: no install prompt exists, show the manual steps instead.
  if (!promptEvent && ios) {
    return (
      <section aria-label="Poner Qwida en su pantalla" className="yari-card bg-surface p-6">
        <div className="flex items-center gap-4">
          <span className="w-16 shrink-0" aria-hidden="true">
            <Art slot="logo-quida" alt="" width={64} className="h-auto w-full" fallback={VoiceIcon} />
          </span>
          <h2 className="yari-headline min-w-0 flex-1 text-p-subtitle font-bold">
            Ponga Qwida en su pantalla
          </h2>
        </div>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-8 text-p-body text-ink">
          <li>Toque el botón Compartir, el cuadrito con la flecha hacia arriba.</li>
          <li>Baje en la lista y toque Agregar a pantalla de inicio.</li>
          <li>Toque Agregar arriba a la derecha.</li>
        </ol>
        <div className="mt-2 text-center">{dismissRow}</div>
      </section>
    );
  }

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    setBIP(null);
  };

  return (
    <section aria-label="Instalar Qwida" className="yari-card bg-surface p-6">
      <div className="flex items-center gap-4">
        <span className="w-16 shrink-0" aria-hidden="true">
          <Art slot="logo-quida" alt="" width={64} className="h-auto w-full" fallback={VoiceIcon} />
        </span>
        <div className="min-w-0">
          <h2 className="yari-headline text-p-subtitle font-bold">Ponga Qwida en su pantalla</h2>
          <p className="mt-1 text-p-body text-ink-soft">Ábrala como una aplicación, sin buscarla.</p>
        </div>
      </div>
      <button type="button" onClick={install} className={`${INSTALL_BTN} mt-5`}>
        Instalar Qwida
      </button>
      <div className="text-center">{dismissRow}</div>
    </section>
  );
}
