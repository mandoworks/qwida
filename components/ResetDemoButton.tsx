"use client";

import { useState } from "react";

/** One tap demo reset: reseeds shared state through POST /api/reset. */
export function ResetDemoButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function reset() {
    setState("busy");
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const label = {
    idle: "Reiniciar demo",
    busy: "Reiniciando…",
    done: "Demo reiniciada",
    error: "No se pudo reiniciar. Intente otra vez.",
  }[state];

  return (
    <button
      type="button"
      onClick={reset}
      disabled={state === "busy"}
      aria-live="polite"
      className="rounded-xl border-2 border-ink-soft bg-surface px-5 py-3 text-p-meta font-bold text-ink-soft disabled:opacity-60"
    >
      {label}
    </button>
  );
}
