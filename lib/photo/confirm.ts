import type { EventStore, QuidaEvent } from "@/lib/store/types";
import { referidoExpiresOn, todayPR } from "./dates";
import { refillCountdown, unitsPerDose } from "./refill";
import type { ConfirmBody, TrustedFields } from "./schema";
import { deriveSlots } from "./trust";

type Values = Record<string, string | number | null>;

export type ConfirmResult =
  | { ok: true; confirmed: QuidaEvent; created: QuidaEvent }
  | { ok: false; status: number; error: string; needsFrequency?: boolean };

/** Extracted values with the person's edits on top. Edits always win. */
export function mergeValues(fields: TrustedFields, edits: Values): Values {
  const out: Values = {};
  for (const [k, f] of Object.entries(fields)) out[k] = f.value;
  for (const [k, v] of Object.entries(edits)) out[k] = typeof v === "string" ? v.trim() || null : v;
  return out;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/**
 * Runs only after a person taps Confirmar. A printed label becomes a CONFIRMADO
 * med_schedule; a referido becomes a CONFIRMADO referido with its 90 day expiry.
 * The new event carries `fromEventId`; the photo event is marked CONFIRMADO.
 * A handwritten prescription is refused: it never becomes a schedule.
 */
export async function confirmPhoto(
  store: EventStore,
  body: Required<Pick<ConfirmBody, "eventId" | "householdId">> & { values: Values; confirmedBy: "patient" | "caregiver" },
  today = todayPR(),
): Promise<ConfirmResult> {
  const event = (await store.list(body.householdId)).find((e) => e.id === body.eventId);
  if (!event) return { ok: false, status: 404, error: "No encontramos esa foto." };
  if (event.status === "CONFIRMADO") return { ok: false, status: 409, error: "Esto ya está confirmado." };
  if (event.kind === "rx_handwritten") {
    return { ok: false, status: 409, error: "Letra de médico: no confiable. Escanee la etiqueta de la farmacia." };
  }
  if (event.kind !== "rx_label" && event.kind !== "referido") {
    return { ok: false, status: 400, error: "Esta foto no se puede confirmar." };
  }

  const v = mergeValues((event.payload.fields ?? {}) as TrustedFields, body.values);
  const edited = Object.keys(body.values);
  const common = {
    synthetic: true,
    simulated: event.payload.simulated === true,
    fromEventId: event.id,
    confirmedBy: body.confirmedBy,
    edited,
  };
  const source = body.confirmedBy === "caregiver" ? "caregiver" : "photo";

  let created: QuidaEvent;
  if (event.kind === "rx_label") {
    const drug = str(v.drug);
    if (!drug) return { ok: false, status: 422, error: "Falta el nombre del medicamento." };
    const timesPerDay = num(v.times_per_day);
    const slots = deriveSlots(str(v.frequency), timesPerDay);
    if (!slots) {
      return { ok: false, status: 422, error: "¿Cuántas veces al día? Escríbalo como dice la etiqueta.", needsFrequency: true };
    }
    const quantity = num(v.quantity);
    const fillDate = str(v.date);
    const refill = refillCountdown({ quantity, perDay: slots.length * unitsPerDose(str(v.dose)), fillDate, today });
    created = await store.create({
      householdId: body.householdId,
      kind: "med_schedule",
      status: "CONFIRMADO",
      source,
      confidence: 1,
      payload: {
        ...common,
        drug,
        dose: str(v.strength),
        take: str(v.dose),
        frequency: str(v.frequency),
        times_per_day: slots.length,
        slots,
        quantity,
        refills: num(v.refills),
        fill_date: fillDate,
        pharmacy: str(v.pharmacy),
        rx_number: str(v.rx_number),
        prescriber: str(v.prescriber),
        refill: refill && { days_supply: refill.days_supply, runs_out_on: refill.runs_out_on, remind_on: refill.remind_on },
      },
    });
  } else {
    const issue = str(v.issue_date);
    const expires_on = issue ? referidoExpiresOn(issue) : null;
    if (!expires_on) return { ok: false, status: 422, error: "Falta la fecha del referido (año, mes y día)." };
    created = await store.create({
      householdId: body.householdId,
      kind: "referido",
      status: "CONFIRMADO",
      source,
      confidence: 1,
      payload: {
        ...common,
        specialty: str(v.specialty),
        issue_date: issue,
        expires_on,
        referring_doctor: str(v.referring_doctor),
        plan: str(v.plan),
      },
    });
  }

  const confirmed = await store.updateStatus(event.id, "CONFIRMADO");
  return { ok: true, confirmed: confirmed ?? event, created };
}

/**
 * Hides a photo event once a confirmation of the same kind replaced it, so a
 * confirmed referido is not listed twice. A label stays: its med_schedule is a different kind.
 */
export function hideReplaced(events: QuidaEvent[]): QuidaEvent[] {
  const replaced = new Set(events.map((e) => `${e.kind}:${String(e.payload.fromEventId)}`));
  return events.filter((e) => !replaced.has(`${e.kind}:${e.id}`));
}
