"use client";

import { useEffect, useRef, useState } from "react";
import { Art } from "@/components/ui/Art";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import type { VisitResponse } from "@/lib/visit/schema";

type Phase =
  | { name: "consent" }
  | { name: "ready" }
  | { name: "recording" }
  | { name: "processing" }
  | { name: "done"; result: VisitResponse }
  | { name: "error"; message: string };

/** Formats Safari and Chrome can both record, best first. */
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

function canRecord(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Consent gated doctor visit capture: consent, record with level meter, upload,
 * then show the extracted BORRADOR items with their source quotes.
 * Falls back to a file upload when the browser cannot record.
 */
export function VisitRecorder({ onDone }: { onDone?: (result: VisitResponse) => void }) {
  const [phase, setPhase] = useState<Phase>({ name: "consent" });
  const [consent, setConsent] = useState({ paciente: false, medico: false });
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [recordable] = useState(canRecord);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }

  useEffect(() => cleanup, []);

  async function upload(blob: Blob, filename: string) {
    setPhase({ name: "processing" });
    try {
      const form = new FormData();
      form.append("audio", blob, filename);
      const res = await fetch("/api/visit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      setPhase({ name: "done", result: data as VisitResponse });
      onDone?.(data as VisitResponse);
    } catch (err) {
      setPhase({
        name: "error",
        message: err instanceof Error ? err.message : "No pudimos procesar la grabación.",
      });
    }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        cleanup();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        upload(new Blob(chunks, { type }), `visita.${ext}`);
      };
      recorderRef.current = recorder;
      recorder.start(1000);

      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setPhase({ name: "recording" });
    } catch {
      cleanup();
      setPhase({
        name: "error",
        message: "No pudimos usar el micrófono. Puede subir un archivo de audio.",
      });
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file, file.name);
  }

  /** Plays the role-played synthetic visit through the real pipeline (actors, fictional doctor). */
  async function sendDemoClip() {
    try {
      const res = await fetch("/demo/visita-1.mp3");
      if (!res.ok) throw new Error();
      upload(await res.blob(), "visita-1.mp3");
    } catch {
      setPhase({ name: "error", message: "No encontramos la grabación de demostración." });
    }
  }

  function restart() {
    setLevel(0);
    setSeconds(0);
    setPhase({ name: "ready" });
  }

  const uploadInput = (
    <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-ink-soft px-5 py-4 text-center text-xl text-ink-soft">
      Subir un archivo de audio
      <input type="file" accept="audio/*" onChange={onFile} className="sr-only" />
    </label>
  );

  return (
    <section aria-label="Grabar la visita médica" className="flex flex-col gap-5 text-patient">
      {phase.name === "consent" && (
        <>
          <h2 className="text-3xl font-bold">Antes de grabar</h2>
          <p>Ambas personas aceptan grabar esta conversación.</p>
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Consentimiento</legend>
            {(
              [
                ["paciente", "Paciente acepta"],
                ["medico", "Médico acepta"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex min-h-btn-patient items-center gap-4 rounded-2xl border-2 border-ink bg-surface px-5"
              >
                <input
                  type="checkbox"
                  checked={consent[key]}
                  onChange={(e) => setConsent((c) => ({ ...c, [key]: e.target.checked }))}
                  className="size-8 accent-accent"
                />
                <span className="font-bold">{label}</span>
              </label>
            ))}
          </fieldset>
          <BigButton disabled={!consent.paciente || !consent.medico} onClick={() => setPhase({ name: "ready" })}>
            Continuar
          </BigButton>
        </>
      )}

      {phase.name === "ready" && (
        <>
          <h2 className="text-3xl font-bold">Grabar la visita</h2>
          <Art slot="microfono" alt="" width={120} className="self-center" />
          {recordable ? (
            <BigButton onClick={start} icon="●">
              Empezar a grabar
            </BigButton>
          ) : (
            <p>Este teléfono no puede grabar aquí. Suba un archivo de audio.</p>
          )}
          {uploadInput}
          <button
            type="button"
            onClick={sendDemoClip}
            className="text-left text-xl text-ink-soft underline underline-offset-4"
          >
            Usar la grabación de demostración (actores, datos sintéticos)
          </button>
        </>
      )}

      {phase.name === "recording" && (
        <>
          <h2 className="text-3xl font-bold">
            Grabando <span className="tabular-nums">{fmtTime(seconds)}</span>
          </h2>
          <div aria-hidden="true" className="h-6 w-full overflow-hidden rounded-full border-2 border-ink bg-surface">
            <div className="h-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <BigButton variant="danger" onClick={stop} icon="■">
            Terminar
          </BigButton>
        </>
      )}

      {phase.name === "processing" && (
        <p role="status" aria-live="polite" className="py-10 text-center text-3xl font-bold">
          Procesando…
        </p>
      )}

      {phase.name === "error" && (
        <>
          <p role="alert" className="rounded-2xl border-2 border-danger bg-surface px-5 py-4 text-danger">
            {phase.message}
          </p>
          <BigButton variant="secondary" onClick={restart}>
            Intentar otra vez
          </BigButton>
          {uploadInput}
        </>
      )}

      {phase.name === "done" && <VisitResult result={phase.result} onAgain={restart} />}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-lg text-ink-soft">{label}</dt>
      <dd className={value ? "font-bold" : "font-bold text-warn"}>{value ?? "Falta: hay que confirmarlo"}</dd>
    </div>
  );
}

function ItemCard({
  title,
  needsConfirmation,
  quote,
  children,
}: {
  title: string;
  needsConfirmation: boolean;
  quote: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-auto font-bold">{title}</h4>
        <Badge kind="BORRADOR" size="patient" />
        {needsConfirmation && <Badge kind="POR_CONFIRMAR" size="patient" />}
      </div>
      <dl className="grid gap-2">{children}</dl>
      <blockquote className="border-l-4 border-accent pl-4 text-lg text-ink-soft">“{quote}”</blockquote>
    </li>
  );
}

function VisitResult({ result, onAgain }: { result: VisitResponse; onAgain: () => void }) {
  const { extraction: x, fence } = result;
  const empty = !x.prescriptions.length && !x.referidos.length && !x.next_appointment;
  return (
    <div className="flex flex-col gap-5">
      {fence.emergency && <EmergencyBanner className="-mx-5" />}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-3xl font-bold">Lo que escuchamos</h2>
        <Badge kind="SINTETICO" size="patient" />
        {result.simulated && <Badge kind="SIMULADO" size="patient" />}
      </div>
      <p className="text-xl">Esto es un borrador. Su familia lo revisa y lo confirma.</p>
      {fence.triggered && <FenceNotice className="text-xl" />}

      {/* On an emergency nothing is extracted on purpose; this line would read as if we listened and found nothing. */}
      {empty && !fence.emergency && <p>No encontramos recetas, referidos ni citas en la grabación.</p>}

      {x.prescriptions.length > 0 && (
        <div>
          <h3 className="mb-3 text-2xl font-bold">Recetas nuevas</h3>
          <ul className="flex flex-col gap-4">
            {x.prescriptions.map((p, i) => (
              <ItemCard key={i} title={p.drug ?? "Medicamento"} needsConfirmation={p.needs_confirmation} quote={p.source_quote}>
                <Field label="Medicamento" value={p.drug} />
                <Field label="Dosis" value={p.dose} />
                <Field label="Cuándo" value={p.frequency} />
              </ItemCard>
            ))}
          </ul>
        </div>
      )}

      {x.referidos.length > 0 && (
        <div>
          <h3 className="mb-3 text-2xl font-bold">Referidos</h3>
          <ul className="flex flex-col gap-4">
            {x.referidos.map((r, i) => (
              <ItemCard key={i} title={r.specialty ?? "Especialista"} needsConfirmation={r.needs_confirmation} quote={r.source_quote}>
                <Field label="Especialidad" value={r.specialty} />
              </ItemCard>
            ))}
          </ul>
        </div>
      )}

      {x.next_appointment && (
        <div>
          <h3 className="mb-3 text-2xl font-bold">Próxima cita</h3>
          <ul>
            <ItemCard
              title="Cita de seguimiento"
              needsConfirmation={x.next_appointment.needs_confirmation}
              quote={x.next_appointment.source_quote}
            >
              <Field label="Cuándo dijo" value={x.next_appointment.date_text} />
              <Field label="Fecha" value={x.next_appointment.resolved_date} />
            </ItemCard>
          </ul>
        </div>
      )}

      {x.questions_back.length > 0 && (
        <div className="rounded-2xl border-2 border-warn bg-surface p-5">
          <h3 className="mb-2 text-2xl font-bold text-warn">Hay que preguntar</h3>
          <ul className="list-disc pl-6">
            {x.questions_back.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <BigButton variant="secondary" onClick={onAgain}>
        Grabar otra visita
      </BigButton>
    </div>
  );
}
