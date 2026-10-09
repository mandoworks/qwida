import { daysBetween, isIsoDate } from "@/lib/photo/dates";
import type { QuidaEvent } from "@/lib/store/types";
import { dayLabel, isoDate, timeLabel } from "./dates";

export type NudgeKind = "label_rescan" | "refill" | "referido" | "appointment";
export type Nudge = { id: string; kind: NudgeKind; /** Spanish text, the caregiver sends it. */ message: string };

/** A referral gets a line inside this window, or when it already expired. */
const REFERIDO_WINDOW_DAYS = 30;
/** "Mañana" only. */
const APPOINTMENT_WINDOW_DAYS = 1;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Ready to send nudges, written from what the events actually say. Nothing is
 * sent anywhere: the caregiver copies the text or opens WhatsApp with it.
 */
export function buildNudges(events: QuidaEvent[], today: string): Nudge[] {
  const out: Nudge[] = [];
  const confirmed = events.filter((e) => e.status === "CONFIRMADO");

  const handwritten = events.filter((e) => e.kind === "rx_handwritten").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const label = events.filter((e) => e.kind === "rx_label").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (handwritten && (!label || label.createdAt < handwritten.createdAt)) {
    out.push({
      id: `${handwritten.id}:label_rescan`,
      kind: "label_rescan",
      message:
        "Mami, cuando recoja la receta, escanee la etiqueta de la farmacia y mándeme la foto. Así vemos bien la dosis.",
    });
  }

  const refill = confirmed
    .filter((e) => e.kind === "med_schedule")
    .flatMap((e) => {
      const r = e.payload.refill as { runs_out_on?: unknown } | undefined;
      const runsOut = isoDate(str(r?.runs_out_on));
      if (!runsOut || !isIsoDate(runsOut)) return [];
      const days = daysBetween(today, runsOut);
      if (days > 14) return [];
      const drug = str(e.payload.drug) ?? "su medicina";
      return [{ id: `${e.id}:refill`, kind: "refill" as const, message: days <= 0 ? `Mami, se nos acabaron las pastillas de ${drug}. ¿Pedimos la recarga hoy?` : `Mami, le quedan unos ${days} días de ${drug}. ¿Vamos a pedir la recarga?` }];
    })
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (refill) out.push(refill);

  const referido = confirmed
    .filter((e) => e.kind === "referido")
    .flatMap((e) => {
      const expires = isoDate(str(e.payload.expires_on));
      if (!expires || !isIsoDate(expires)) return [];
      const days = daysBetween(today, expires);
      if (days > REFERIDO_WINDOW_DAYS) return [];
      const specialty = str(e.payload.specialty) ?? "especialidad";
      return [
        {
          id: `${e.id}:referido`,
          kind: "referido" as const,
          message:
            days < 0
              ? `Mami, su referido de ${specialty} se venció el ${dayLabel(expires)}. Hay que pedirlo otra vez.`
              : `Mami, su referido de ${specialty} vence el ${dayLabel(expires)}. Vamos a renovarlo.`,
        },
      ];
    })
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (referido) out.push(referido);

  const appointment = confirmed
    .filter((e) => e.kind === "appointment")
    .flatMap((e) => {
      const date = str(e.payload.date);
      const day = isoDate(date);
      if (!day || !isIsoDate(day)) return [];
      const days = daysBetween(today, day);
      if (days < 0 || days > APPOINTMENT_WINDOW_DAYS) return [];
      const specialty = str(e.payload.specialty) ?? "seguimiento";
      const time = timeLabel(date);
      const place = str(e.payload.place);
      const when = days === 0 ? "hoy" : "mañana";
      return [
        {
          id: `${e.id}:appointment`,
          kind: "appointment" as const,
          message: `Mami, ${when} tiene cita de ${specialty}${time ? ` a las ${time}` : ""}${place ? ` en ${place}` : ""}. ¿Le dejo el Uber o la lleva tía?`,
        },
      ];
    })
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (appointment) out.push(appointment);

  return out;
}

/** WhatsApp delivery only: opens the chat with the text written. No API, no account. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
