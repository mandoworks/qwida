"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { formatDia, referidoExpiresOn, todayPR } from "@/lib/photo/dates";
import { scheduleItems } from "@/lib/photo/schedule";
import type { TrustedField, TrustedFields } from "@/lib/photo/schema";
import { HANDWRITTEN_BADGE, LABEL_RESCAN_TEXT } from "@/lib/photo/trust";
import type { QuidaEvent } from "@/lib/store/types";
import { MedSchedule, type PhotoSize } from "./MedSchedule";
import { ReferidoCountdown } from "./ReferidoCountdown";

const LABELS: Record<string, string> = {
  drug: "Medicamento",
  strength: "Concentración",
  dose: "Cuánto tomar",
  frequency: "Cada cuánto",
  times_per_day: "Veces al día",
  quantity: "Cantidad",
  refills: "Repeticiones",
  prescriber: "Médico",
  pharmacy: "Farmacia",
  rx_number: "Número de receta",
  date: "Fecha",
  specialty: "Especialidad",
  issue_date: "Fecha del referido",
  referring_doctor: "Médico que refiere",
  plan: "Plan médico",
};
const DATE_FIELDS = new Set(["date", "issue_date"]);
const NUMBER_FIELDS = new Set(["times_per_day", "quantity", "refills"]);
const FREQUENCIES = ["una vez al día", "dos veces al día", "tres veces al día", "cuatro veces al día"];

export type ConfirmResponse = { confirmed: QuidaEvent; created: QuidaEvent };

const asText = (v: TrustedField["value"]) => (v === null ? "" : String(v));

/**
 * Photo beside the fields read from it. Low confidence fields start empty and
 * glow amber until a person fills them; Confirmar is the only path to CONFIRMADO.
 * Handwriting gets the "no confiable" badge and no Confirmar at all.
 */
export function ExtractedFields({
  event,
  householdId,
  size = "caregiver",
  onConfirmed,
  onDefer,
}: {
  event: QuidaEvent;
  householdId?: string;
  size?: PhotoSize;
  onConfirmed?: (r: ConfirmResponse) => void;
  /** Patient side: "Mi hija lo revisa". Leaves the event POR_CONFIRMAR for the caregiver. */
  onDefer?: () => void;
}) {
  const p = event.payload;
  const fields = (p.fields ?? {}) as TrustedFields;
  const handwritten = event.kind === "rx_handwritten";
  const patient = size === "patient";

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.prefill ? asText(f.value) : ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askFrequency, setAskFrequency] = useState(false);
  const [done, setDone] = useState<ConfirmResponse | null>(null);

  const confirmed = done !== null || event.status === "CONFIRMADO";
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  async function confirm(extra: Record<string, string> = {}) {
    const all = { ...values, ...extra };
    // Only send what differs from what was read: an empty low confidence field is sent as null.
    const changed = Object.fromEntries(
      Object.entries(all)
        .filter(([k, v]) => v.trim() !== asText(fields[k]?.value ?? null))
        .map(([k, v]) => [k, v.trim() || null]),
    );
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/photo/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, householdId, values: changed, confirmedBy: size }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAskFrequency(Boolean(data.needsFrequency));
        setError(typeof data.error === "string" ? data.error : "No se pudo confirmar.");
        return;
      }
      setAskFrequency(false);
      setDone(data);
      onConfirmed?.(data);
    } catch {
      setError("No hay conexión. Intente otra vez.");
    } finally {
      setBusy(false);
    }
  }

  function pickFrequency(i: number) {
    const extra = { frequency: FREQUENCIES[i], times_per_day: String(i + 1) };
    setValues((prev) => ({ ...prev, ...extra }));
    confirm(extra);
  }

  const issue = values.issue_date;
  const expiresPreview = event.kind === "referido" && issue ? referidoExpiresOn(issue) : null;

  return (
    <section aria-label="Datos leídos de la foto" className={`flex flex-col gap-5 ${patient ? "text-patient" : "text-caregiver"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind={confirmed ? "CONFIRMADO" : event.status} />
        {p.simulated === true && <Badge kind="SIMULADO" />}
      </div>

      {handwritten && (
        <div role="note" className="flex flex-col gap-2 rounded-2xl border-2 border-warn bg-surface p-4">
          <p className={`font-bold text-warn ${patient ? "text-3xl" : "text-xl"}`}>{HANDWRITTEN_BADGE}</p>
          <p>{LABEL_RESCAN_TEXT}</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {typeof p.image === "string" && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from the upload, nothing to optimize
          <img src={p.image} alt="Foto enviada" className="w-full rounded-2xl border-2 border-line bg-surface object-contain" />
        )}

        <div className="flex flex-col gap-3">
          {Object.entries(fields).map(([k, f]) => (
            <FieldRow
              key={k}
              name={k}
              field={f}
              value={values[k] ?? ""}
              readOnly={handwritten || confirmed}
              patient={patient}
              onChange={(v) => set(k, v)}
            />
          ))}
          {Array.isArray(p.unreadable_lines) && p.unreadable_lines.length > 0 && (
            <ul className="list-disc pl-6 text-warn">
              {p.unreadable_lines.map((l) => (
                <li key={String(l)}>{String(l)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {expiresPreview && !confirmed && <p>Si la fecha es correcta, vence el {formatDia(expiresPreview)}.</p>}

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-surface px-4 py-3 text-danger">
          {error}
        </p>
      )}

      {askFrequency && !confirmed && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">¿Cuántas veces al día dice la etiqueta?</legend>
          <div className="grid grid-cols-2 gap-2">
            {FREQUENCIES.map((label, i) => (
              <button
                key={label}
                type="button"
                disabled={busy}
                onClick={() => pickFrequency(i)}
                className="min-h-14 rounded-xl border-2 border-ink bg-surface px-3 py-2 font-bold"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!handwritten && !confirmed && (
        <BigButton onClick={() => confirm()} disabled={busy} className={patient ? "" : "min-h-0 py-3 text-xl"}>
          {busy ? "Confirmando…" : "Confirmar"}
        </BigButton>
      )}
      {onDefer && !confirmed && (
        <BigButton variant="secondary" onClick={onDefer} disabled={busy} className={patient ? "" : "min-h-0 py-3 text-xl"}>
          Mi hija lo revisa
        </BigButton>
      )}

      {done?.created.kind === "med_schedule" && (
        <MedSchedule items={scheduleItems([done.created], todayPR())} size={size} />
      )}
      {done?.created.kind === "referido" && typeof done.created.payload.expires_on === "string" && (
        <ReferidoCountdown
          specialty={typeof done.created.payload.specialty === "string" ? done.created.payload.specialty : null}
          expiresOn={done.created.payload.expires_on}
          size={size}
        />
      )}
    </section>
  );
}

function FieldRow({
  name,
  field,
  value,
  readOnly,
  patient,
  onChange,
}: {
  name: string;
  field: TrustedField;
  value: string;
  readOnly: boolean;
  patient: boolean;
  onChange: (v: string) => void;
}) {
  const id = `photo-field-${name}`;
  const read = asText(field.value);
  const warn = field.highlight;
  return (
    <div className={`flex flex-col gap-1 rounded-xl border-2 p-3 ${warn ? "border-warn bg-warn/10" : "border-line bg-surface"}`}>
      <label htmlFor={id} className="text-ink-soft">
        {LABELS[name] ?? name}
        {warn && <span className="ml-2 font-bold text-warn">Revise este dato</span>}
      </label>
      {readOnly ? (
        <p id={id} className={`font-bold ${read ? "" : "text-warn"}`}>
          {read || "No se puede leer"}
        </p>
      ) : (
        <input
          id={id}
          type={DATE_FIELDS.has(name) ? "date" : "text"}
          inputMode={NUMBER_FIELDS.has(name) ? "numeric" : undefined}
          value={value}
          placeholder={read && !field.prefill ? `Leído: ${read}` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border-2 border-ink bg-surface px-3 font-bold ${patient ? "min-h-14 py-2" : "py-2"}`}
        />
      )}
      {!readOnly && read && !field.prefill && value !== read && (
        <button type="button" onClick={() => onChange(read)} className="self-start font-bold text-accent underline">
          Usar «{read}»
        </button>
      )}
      {field.source_text && field.source_text !== read && <p className="text-ink-soft">En la foto: “{field.source_text}”</p>}
      {field.mismatch && (
        <p className="font-bold text-warn">
          En la visita: {field.mismatch.visit} · En la foto: {read || "nada"}. {field.mismatch.note}
        </p>
      )}
    </div>
  );
}
