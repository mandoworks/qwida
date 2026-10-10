import type { Who } from "@/lib/audit";
import type { EventStore, QuidaEvent } from "@/lib/store/types";
import { isIsoDate, referidoExpiresOn, todayPR } from "./dates";
import { refillCountdown, unitsPerDose } from "./refill";
import type { ConfirmBody, TrustedFields } from "./schema";
import { deriveSlots, isTime } from "./trust";

type Values = Record<string, string | number | null>;

export type ConfirmResult =
  | { ok: true; confirmed: QuidaEvent; created: QuidaEvent | null }
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

/** Puerto Rico is on AST all year, no daylight saving. */
const PR_OFFSET = "-04:00";

/**
 * Runs only after a person taps Confirmar. A printed label becomes a new
 * CONFIRMADO med_schedule (with `fromEventId`) and the label is marked CONFIRMADO;
 * a referido is confirmed in place with its 90 day expiry; an appointment card
 * is confirmed in place with its date and time. A handwritten prescription is
 * refused: it never becomes a schedule.
 */
export async function confirmPhoto(
  store: EventStore,
  body: Required<Pick<ConfirmBody, "eventId" | "householdId">> & { values: Values; confirmedBy: "patient" | "caregiver" },
  today = todayPR(),
  who: Who = { name: null, device: null },
  now = new Date(),
): Promise<ConfirmResult> {
  const event = (await store.list(body.householdId)).find((e) => e.id === body.eventId);
  if (!event) return { ok: false, status: 404, error: "No encontramos esa foto." };
  if (event.status === "CONFIRMADO") return { ok: false, status: 409, error: "Esto ya está confirmado." };
  if (event.kind === "rx_handwritten") {
    return { ok: false, status: 409, error: "Letra de médico: no confiable. Escanee la etiqueta de la farmacia." };
  }
  // An appointment heard in a visit has no photo fields; it is confirmed in Revisar.
  const photoAppointment = event.kind === "appointment" && event.payload.fields;
  if (event.kind !== "rx_label" && event.kind !== "referido" && !photoAppointment) {
    return { ok: false, status: 400, error: "Esta foto no se puede confirmar." };
  }

  const stamp = {
    confirmedBy: body.confirmedBy,
    confirmedAt: now.toISOString(),
    confirmedName: who.name,
    confirmedDevice: who.device,
  };
  const v = mergeValues((event.payload.fields ?? {}) as TrustedFields, body.values);
  const edited = Object.keys(body.values);
  const common = {
    synthetic: true,
    simulated: event.payload.simulated === true,
    fromEventId: event.id,
    ...stamp,
    edited,
  };
  const source = body.confirmedBy === "caregiver" ? "caregiver" : "photo";

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
    const created = await store.create({
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
    // The label itself is now confirmed and points at its schedule.
    const confirmed = await store.update(event.id, {
      status: "CONFIRMADO",
      payload: { ...stamp, edited, scheduleId: created.id },
    });
    return { ok: true, confirmed: confirmed ?? event, created };
  }

  if (event.kind === "appointment") {
    const day = str(v.date);
    if (!isIsoDate(day)) return { ok: false, status: 422, error: "Falta la fecha de la cita (año, mes y día)." };
    const time = str(v.time);
    if (time && !isTime(time)) return { ok: false, status: 422, error: "Escriba la hora como 10:30 o 14:30." };
    // `date` is what the digest, the calendar and the patient read; with a time it carries the PR offset.
    const confirmed = await store.update(event.id, {
      status: "CONFIRMADO",
      payload: {
        ...stamp,
        edited,
        date: time ? `${day}T${time}:00${PR_OFFSET}` : day,
        time,
        specialty: str(v.specialty),
        doctor: str(v.doctor),
        place: str(v.place),
        phone: str(v.phone),
      },
    });
    if (!confirmed) return { ok: false, status: 404, error: "No encontramos esa foto." };
    return { ok: true, confirmed, created: null };
  }

  const issue = str(v.issue_date);
  const expires_on = issue ? referidoExpiresOn(issue) : null;
  if (!expires_on) return { ok: false, status: 422, error: "Falta la fecha del referido (año, mes y día)." };
  // A referido is confirmed in place: same event, final values on top of what was read.
  const confirmed = await store.update(event.id, {
    status: "CONFIRMADO",
    payload: {
      ...stamp,
      edited,
      specialty: str(v.specialty),
      issue_date: issue,
      expires_on,
      referring_doctor: str(v.referring_doctor),
      plan: str(v.plan),
    },
  });
  if (!confirmed) return { ok: false, status: 404, error: "No encontramos esa foto." };
  return { ok: true, confirmed, created: null };
}
