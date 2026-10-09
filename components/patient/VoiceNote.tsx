"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import type { NoteResponse } from "@/lib/note";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { MicIcon } from "./Icons";

type Phase = "idle" | "recording" | "review" | "sending" | "sent" | "failed" | "denied";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

/**
 * Short voice note for Marisol. Supports real microphone recording,
 * demo audio clips, and uploads to /api/note with Fence safety checks.
 */
export function VoiceNote() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("nota.webm");
  const [result, setResult] = useState<NoteResponse | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function release() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => release, []);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setPhase("denied");
      return;
    }

    chunksRef.current = [];
    const mime = pickMime();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
      setAudioBlob(blob);
      setFilename("nota.webm");
    };

    recorder.start(250);
    setSeconds(0);
    setPhase("recording");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    release();
    setPhase("review");
  }

  async function sendDemoClip() {
    try {
      const res = await fetch("/demo/nota-cita.mp3");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setAudioBlob(blob);
      setFilename("nota-cita.mp3");
      setSeconds(8);
      setPhase("review");
    } catch {
      setPhase("failed");
    }
  }

  async function send() {
    setPhase("sending");
    try {
      const form = new FormData();
      if (audioBlob) {
        form.append("audio", audioBlob, filename);
      }
      form.append("durationSec", String(seconds || 1));
      form.append("householdId", HOUSEHOLD_ID);

      const res = await fetch("/api/note", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error();
      const data: NoteResponse = await res.json();
      setResult(data);
      setPhase("sent");
    } catch {
      setPhase("failed");
    }
  }

  function reset() {
    release();
    setAudioBlob(null);
    setResult(null);
    setSeconds(0);
    setPhase("idle");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind="SINTETICO" className="w-fit" />
        {result?.simulated && <Badge kind="SIMULADO" className="w-fit" />}
      </div>

      {phase === "idle" && (
        <>
          <BigButton onClick={start} icon={<MicIcon />}>
            Presione aquí para hablar
          </BigButton>
          <BigButton variant="secondary" onClick={sendDemoClip}>
            Usar grabación de demostración
          </BigButton>
        </>
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
          <p className="text-p-body font-bold">¿Se lo enviamos a Marisol?</p>
          <p className="text-p-meta text-ink-soft">Grabación lista ({fmt(seconds)}).</p>
          <BigButton onClick={send}>Sí, enviar</BigButton>
          <BigButton variant="secondary" onClick={reset}>
            No, grabar otra vez
          </BigButton>
        </>
      )}

      {phase === "sending" && (
        <p role="status" className="rounded-2xl border-2 border-line bg-surface px-5 py-4 text-center text-p-body font-bold">
          Enviando nota a Marisol…
        </p>
      )}

      {phase === "sent" && (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-2xl border-2 border-ok bg-ok-soft px-5 py-4 text-p-body font-bold text-ink">
            Gracias, se lo enviamos a Marisol.
          </p>

          {result?.transcript && (
            <div className="rounded-2xl border-2 border-line bg-surface p-4">
              <span className="text-p-meta text-ink-soft">Mensaje registrado:</span>
              <p className="mt-1 text-p-body font-bold italic text-ink">
                &ldquo;{result.transcript}&rdquo;
              </p>
            </div>
          )}

          {result?.fence?.emergency && <EmergencyBanner className="rounded-2xl" />}

          {result?.fence?.medChange && (
            <p className="rounded-2xl border-2 border-warn bg-warn-soft p-4 text-p-body font-bold text-ink">
              Aviso: Marisol revisará el cambio de medicamento con el médico antes de confirmar.
            </p>
          )}

          <BigButton variant="secondary" onClick={reset}>
            Mandar otra nota
          </BigButton>
        </div>
      )}

      {phase === "failed" && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft px-5 py-4 text-p-body text-danger">
            No se pudo enviar. Intente otra vez.
          </p>
          <BigButton onClick={send}>Reintentar envío</BigButton>
          <BigButton variant="secondary" onClick={reset}>
            Empezar de nuevo
          </BigButton>
        </div>
      )}

      {phase === "denied" && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft px-5 py-4 text-p-body text-danger">
          No pudimos usar el micrófono. Pídale ayuda a Marisol o use la grabación de demostración.
        </p>
      )}

      {phase === "idle" && (
        <p className="text-p-body text-ink-soft">
          Habla normal como si llamaras a Marisol. Ella recibe tu mensaje de voz directamente.
        </p>
      )}
    </div>
  );
}
