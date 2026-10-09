"use client";

import { useEffect, useState } from "react";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import type { PhotoResponse } from "@/lib/photo/schema";
import { ExtractedFields, type ConfirmResponse } from "./ExtractedFields";
import type { PhotoSize } from "./MedSchedule";

type Phase =
  | { name: "idle" }
  | { name: "preview"; blob: Blob; url: string }
  | { name: "processing"; url: string }
  | { name: "result"; result: PhotoResponse }
  | { name: "deferred" }
  | { name: "error"; message: string };

/** Longest side read by the model. Keeps uploads well under the 4.5 MB limit. */
const MAX_SIDE = 1600;
/** Smaller copy saved with the event (about 100 KB) so it fits the shared store and the other phone sees it. */
const PREVIEW_SIDE = 960;

/** Re-encode as JPEG at most `side` px. Falls back to the original file if the browser cannot. */
async function shrink(file: Blob, side = MAX_SIDE, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * FotoReceta capture: camera (or file picker), preview, send, then the fields
 * read from the photo for a person to confirm.
 */
export function PhotoCapture({
  householdId,
  onResult,
  onConfirmed,
  hint,
  size = "patient",
}: {
  householdId?: string;
  onResult?: (result: PhotoResponse) => void;
  onConfirmed?: (r: ConfirmResponse) => void;
  /** Demo: rx_handwritten, rx_label or referido picks the SIMULADO fixture. */
  hint?: string;
  size?: PhotoSize;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const patient = size === "patient";

  const previewUrl = phase.name === "preview" || phase.name === "processing" ? phase.url : null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const blob = await shrink(file);
    setPhase({ name: "preview", blob, url: URL.createObjectURL(blob) });
  }

  async function send(blob: Blob, url: string) {
    setPhase({ name: "processing", url });
    const form = new FormData();
    form.append("image", blob, "foto.jpg");
    form.append("preview", await shrink(blob, PREVIEW_SIDE, 0.7), "vista.jpg");
    if (householdId) form.append("householdId", householdId);
    if (hint) form.append("hint", hint);
    try {
      const res = await fetch("/api/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No pudimos leer la foto.");
      setPhase({ name: "result", result: data });
      onResult?.(data);
    } catch (err) {
      setPhase({ name: "error", message: err instanceof Error ? err.message : "No pudimos leer la foto." });
    }
  }

  const again = () => setPhase({ name: "idle" });
  const btn = patient ? "" : "min-h-0 py-3 text-xl";

  return (
    <section aria-label="Mandar una foto" className={`flex flex-col gap-5 ${patient ? "text-patient" : "text-caregiver"}`}>
      {phase.name === "idle" && (
        <>
          <label className={`flex cursor-pointer items-center justify-center rounded-2xl border-2 border-accent bg-accent px-6 text-center font-bold text-accent-ink ${patient ? "min-h-btn-patient text-patient" : "py-3 text-xl"}`}>
            Tomar foto
            <input type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" />
          </label>
          <label className={`block cursor-pointer rounded-2xl border-2 border-dashed border-ink-soft px-5 py-4 text-center text-ink-soft ${patient ? "text-xl" : ""}`}>
            O escoja una foto guardada
            <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
        </>
      )}

      {(phase.name === "preview" || phase.name === "processing") && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={phase.url} alt="Vista previa de la foto" className="max-h-[60vh] w-full rounded-2xl border-2 border-line object-contain" />
          {phase.name === "preview" ? (
            <>
              <BigButton onClick={() => send(phase.blob, phase.url)} className={btn}>
                Enviar foto
              </BigButton>
              <BigButton variant="secondary" onClick={again} className={btn}>
                Tomar otra
              </BigButton>
            </>
          ) : (
            <p role="status" aria-live="polite" className="py-6 text-center text-3xl font-bold">
              Procesando…
            </p>
          )}
        </>
      )}

      {phase.name === "result" && (
        <>
          {phase.result.fence.emergency && <EmergencyBanner className="-mx-5" />}
          {phase.result.fence.triggered && <FenceNotice />}
          {phase.result.message ? (
            <p role="status" className="rounded-2xl border-2 border-warn bg-surface px-4 py-3">
              {phase.result.message}
            </p>
          ) : (
            phase.result.events
              .filter((e) => e.kind === "rx_handwritten" || e.kind === "rx_label" || e.kind === "referido")
              .map((e) => (
                <ExtractedFields
                  key={e.id}
                  event={e}
                  householdId={householdId}
                  size={size}
                  onConfirmed={onConfirmed}
                  onDefer={patient ? () => setPhase({ name: "deferred" }) : undefined}
                />
              ))
          )}
          <BigButton variant="secondary" onClick={again} className={btn}>
            Mandar otra foto
          </BigButton>
        </>
      )}

      {phase.name === "deferred" && (
        <>
          <p role="status" className="text-3xl font-bold">
            Listo. Su hija lo va a revisar.
          </p>
          <BigButton variant="secondary" onClick={again}>
            Mandar otra foto
          </BigButton>
        </>
      )}

      {phase.name === "error" && (
        <>
          <p role="alert" className="rounded-2xl border-2 border-danger bg-surface px-5 py-4 text-danger">
            {phase.message}
          </p>
          <BigButton variant="secondary" onClick={again} className={btn}>
            Intentar otra vez
          </BigButton>
        </>
      )}
    </section>
  );
}
