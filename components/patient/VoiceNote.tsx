"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { MicIcon } from "./Icons";

type Phase = "idle" | "recording" | "review" | "sent" | "denied";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Short voice note for Marisol. The microphone and the Sí / No flow are real;
 * sending is SIMULADO: no audio leaves the phone and no event is written yet.
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

      {phase === "review" && (
        <>
          <p className="text-patient font-bold">¿Se lo enviamos a Marisol?</p>
          <BigButton onClick={() => setPhase("sent")}>Sí</BigButton>
          <BigButton variant="secondary" onClick={() => setPhase("idle")}>
            No, otra vez
          </BigButton>
        </>
      )}

      {phase === "sent" && (
        <p role="status" className="rounded-2xl border-2 border-ok bg-surface px-5 py-4 text-patient font-bold">
          Gracias, se lo enviamos a Marisol.
        </p>
      )}

      {phase === "denied" && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-surface px-5 py-4 text-patient text-danger">
          No pudimos usar el micrófono. Pídale ayuda a Marisol.
        </p>
      )}

      {phase !== "denied" && (
        <p className="text-patient text-ink-soft">Simulado: la nota todavía no se envía de verdad.</p>
      )}
    </div>
  );
}
