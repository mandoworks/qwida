"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { MicIcon } from "./Icons";

type Phase = "idle" | "recording" | "review" | "sent" | "failed" | "denied";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Short voice note for Marisol. The microphone, the Sí / No flow and the
 * `voice_note` event are real; no audio leaves the phone and the text is a
 * fixed SIMULADO stand in until transcription lands.
 */
export function VoiceNote() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function release() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => release, []);

  async function start() {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("denied");
      return;
    }
    setSeconds(0);
    setPhase("recording");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    release();
    setPhase("review");
  }

  async function send() {
    const body = {
      householdId: HOUSEHOLD_ID,
      kind: "voice_note",
      source: "voice",
      status: "POR_CONFIRMAR",
      payload: { durationSec: seconds, text: "Nota de voz de Mamá", simulated: true },
    };
    const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setPhase(res?.ok ? "sent" : "failed");
  }

  return (
    <div className="flex flex-col gap-5">
      <Badge kind="SIMULADO" className="w-fit" />

      {phase === "idle" && (
        <BigButton onClick={start} icon={<MicIcon />}>
          Presione aquí para hablar
        </BigButton>
      )}

      {phase === "recording" && (
        <>
          <p role="status" className="text-center text-4xl font-bold tabular-nums">
            Grabando {fmt(seconds)}
          </p>
          <BigButton variant="danger" onClick={stop}>
            Terminar
          </BigButton>
        </>
      )}

      {(phase === "review" || phase === "failed") && (
        <>
          <p className="text-p-body font-bold">¿Se lo enviamos a Marisol?</p>
          <BigButton onClick={send}>Sí</BigButton>
          <BigButton variant="secondary" onClick={() => setPhase("idle")}>
            No, otra vez
          </BigButton>
        </>
      )}

      {phase === "sent" && (
        <p role="status" className="rounded-2xl border-2 border-ok bg-ok-soft px-5 py-4 text-p-body font-bold">
          Gracias, se lo enviamos a Marisol.
        </p>
      )}

      {phase === "failed" && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft px-5 py-4 text-p-body text-danger">
          No se pudo enviar. Intente otra vez.
        </p>
      )}

      {phase === "denied" && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft px-5 py-4 text-p-body text-danger">
          No pudimos usar el micrófono. Pídale ayuda a Marisol.
        </p>
      )}

      {phase !== "denied" && (
        <p className="text-p-body text-ink-soft">Simulado: el texto de la nota es de prueba, todavía no se transcribe.</p>
      )}
    </div>
  );
}
