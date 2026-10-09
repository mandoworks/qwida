"use client";

import { useSyncExternalStore } from "react";
import { useLocalValue } from "./useLocalValue";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Small, dismissible add to home screen hint. Hidden once Quida runs as an installed app. */
export function InstallHint() {
  const [dismissed, setDismissed] = useLocalValue("quida.installHint");
  const standalone = useSyncExternalStore(
    () => () => {},
    isStandalone,
    () => true,
  );
  if (standalone || dismissed !== null) return null;
  return (
    <aside
      aria-label="Consejo"
      className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-xl"
    >
      <p>Agregue Quida a su pantalla de inicio</p>
      <button
        type="button"
        onClick={() => setDismissed("1")}
        aria-label="Cerrar el consejo"
        className="min-h-14 min-w-14 shrink-0 rounded-xl border-2 border-ink-soft bg-surface text-2xl font-bold"
      >
        ✕
      </button>
    </aside>
  );
}
