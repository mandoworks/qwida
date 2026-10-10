"use client";

import { useState } from "react";

/** Household used only for warm up calls. Never demo-carmen, never a reset. */
const HOUSEHOLD = "jurado";

type Check = { name: string; seconds: number; result: "REAL" | "SIMULADO" | "FALLA" };

async function file(path: string, name: string): Promise<File> {
  const blob = await (await fetch(path)).blob();
  return new File([blob], name, { type: blob.type });
}

async function timed(name: string, run: () => Promise<Response>): Promise<Check> {
  const t0 = performance.now();
  try {
    const res = await run();
    const body = res.ok ? await res.json().catch(() => ({})) : null;
    const seconds = (performance.now() - t0) / 1000;
    if (!body) return { name, seconds, result: "FALLA" };
    return { name, seconds, result: body.simulated ? "SIMULADO" : "REAL" };
  } catch {
    return { name, seconds: (performance.now() - t0) / 1000, result: "FALLA" };
  }
}

function form(field: string, f: File): FormData {
  const fd = new FormData();
  fd.append(field, f);
  fd.append("householdId", HOUSEHOLD);
  return fd;
}

/**
 * One tap warm up before presenting: calls the four AI routes once, in parallel, on a
 * separate household, so the first real call on stage is not a cold start.
 */
export function WarmupButton() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [checks, setChecks] = useState<Check[]>([]);

  async function warm() {
    setState("busy");
    setChecks([]);
    const [nota, visita, foto] = await Promise.all([
      file("/demo/nota-cita.mp3", "nota-cita.mp3"),
      file("/demo/visita-1.mp3", "visita-1.mp3"),
      file("/icons/icon-512.png", "foto.png"),
    ]);
    const results = await Promise.all([
      timed("Nota de voz", () => fetch("/api/note", { method: "POST", body: form("audio", nota) })),
      timed("Visita", () => fetch("/api/visit", { method: "POST", body: form("audio", visita) })),
      timed("Foto", () => fetch("/api/photo", { method: "POST", body: form("image", foto) })),
      timed("Tarjeta", () =>
        fetch("/api/weekcard/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ householdId: HOUSEHOLD }),
        }),
      ),
    ]);
    setChecks(results);
    setState("done");
  }

  const ready = state === "done" && checks.every((c) => c.result === "REAL");

  return (
    <div className="flex flex-col items-center gap-2" aria-live="polite">
      <button
        type="button"
        onClick={warm}
        disabled={state === "busy"}
        className="rounded-xl border-2 border-ink-soft bg-surface px-5 py-3 text-p-meta font-bold text-ink-soft disabled:opacity-60"
      >
        {state === "busy" ? "Calentando la IA…" : "Calentar la IA"}
      </button>
      {state === "done" && (
        <p className={`text-p-meta font-bold ${ready ? "text-ok" : "text-danger"}`}>
          {ready ? "Lista: " : "Revisar: "}
          {checks.map((c) => `${c.name} ${c.seconds.toFixed(1)} s ${c.result}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
