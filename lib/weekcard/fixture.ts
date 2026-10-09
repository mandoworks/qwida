import { daysBetween, isIsoDate } from "@/lib/photo/dates";
import { normalize } from "@/lib/fence";
import type { QuidaEvent } from "@/lib/store/types";
import { dayLabel, isoDate, timeLabel } from "./dates";
import { DEFAULT_CARD_TITLE, type CardItem, type WeekCard } from "./schema";

/** The card only talks about the next week. */
const WEEK_DAYS = 7;
/** A referido gets a line once it is inside this window or already expired. */
const REFERIDO_WINDOW_DAYS = 45;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

export type ConfirmedFacts = {
  appointments: { id: string; date: string; specialty: string | null; doctor: string | null; place: string | null }[];
  meds: { id: string; drug: string; dose: string | null; slots: string[] }[];
  referidos: { id: string; specialty: string | null; expires_on: string }[];
  questions: string[];
  pending: number;
};

/** Only CONFIRMADO events become the card. BORRADOR and POR_CONFIRMAR never reach her. */
export function confirmedFacts(events: QuidaEvent[], today: string): ConfirmedFacts {
  const confirmed = events.filter((e) => e.status === "CONFIRMADO");

  const appointments = confirmed
    .filter((e) => e.kind === "appointment")
    .flatMap((e) => {
      const date = str(e.payload.date);
      if (!date) return [];
      return [{ id: e.id, date, specialty: str(e.payload.specialty), doctor: str(e.payload.doctor), place: str(e.payload.place) }];
    })
    .filter((a) => daysBetween(today, isoDate(a.date) ?? today) <= WEEK_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date));

  const meds = confirmed
    .filter((e) => e.kind === "med_schedule")
    .flatMap((e) => {
      const drug = str(e.payload.drug);
      if (!drug) return [];
      const slots = Array.isArray(e.payload.slots) ? e.payload.slots.filter((s): s is string => typeof s === "string") : [];
      return [{ id: e.id, drug, dose: str(e.payload.dose), slots }];
    });

  const referidos = confirmed
    .filter((e) => e.kind === "referido")
    .flatMap((e) => {
      const expires = isoDate(str(e.payload.expires_on));
      if (!expires || !isIsoDate(expires)) return [];
      const days = daysBetween(today, expires);
      if (days > REFERIDO_WINDOW_DAYS) return [];
      return [{ id: e.id, specialty: str(e.payload.specialty), expires_on: expires }];
    })
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on));

  const visit = [...events]
    .filter((e) => e.kind === "visit")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const asked = Array.isArray(visit?.payload.questions_back)
    ? (visit?.payload.questions_back ?? []).filter((q): q is string => typeof q === "string")
    : [];

  const pending = events.filter((e) => e.status !== "CONFIRMADO" && e.kind !== "nudge").length;

  return { appointments, meds, referidos, questions: asked.slice(0, 3), pending };
}

/**
 * SIMULADO card, built with plain rules from the confirmed events. Used when
 * there is no AI Gateway key and when the model call fails, so the demo always
 * has a card. Same shape the model returns.
 */
export function buildFixtureCard(events: QuidaEvent[], today: string): WeekCard {
  const facts = confirmedFacts(events, today);
  const items: CardItem[] = [];

  for (const a of facts.appointments) {
    const date = isoDate(a.date);
    const who = a.doctor ? ` con ${a.doctor.replace(/\s*\(ficticia\w*\)\s*/i, "")}` : "";
    items.push({
      day: date ? dayLabel(date) : a.date,
      time: timeLabel(a.date) ?? undefined,
      text: `Cita de ${a.specialty ?? "seguimiento"}${who}${a.place ? ` en ${a.place.replace(/\s*\(ficticio\w*\)\s*/i, "")}` : ""}.`,
      icon: "+",
    });
  }

  for (const m of facts.meds) {
    const when = m.slots.length ? ` (${m.slots.join(", ")})` : "";
    items.push({
      day: "Todos los días",
      text: `Medicamento confirmado: ${m.drug}${m.dose ? ` ${m.dose}` : ""}${when}.`,
      icon: "◆",
    });
  }

  for (const r of facts.referidos) {
    items.push({
      day: daysBetween(today, r.expires_on) < 0 ? "Vencido" : "Esta semana",
      text: `Renovar el referido de ${r.specialty ?? "especialidad"}. Vence el ${dayLabel(r.expires_on)}.`,
      icon: "▤",
    });
  }

  const questions = [...facts.questions];
  if (!questions.length && facts.pending > 0) {
    questions.push("¿Puede revisar en Quida los datos que todavía están en POR CONFIRMAR?");
  }
  if (!questions.length) {
    questions.push("¿Necesita usted que le repitamos algo en la próxima cita?");
  }

  return {
    title: DEFAULT_CARD_TITLE,
    items,
    questionsForDoctor: questions,
  };
}

/** How many times a day a confirmed schedule asks for the drug, for the digest. */
export function dosesPerDay(e: QuidaEvent): number | null {
  const fields = e.payload.fields as Record<string, { value?: unknown }> | undefined;
  const fromLabel = num(fields?.times_per_day?.value);
  if (fromLabel !== null) return fromLabel;
  const words: Record<string, number> = {
    "una vez al dia": 1,
    "dos veces al dia": 2,
    "tres veces al dia": 3,
    "cuatro veces al dia": 4,
    "una pastilla al dia": 1,
    "una pastilla en la noche": 1,
  };
  const frequency = str(e.payload.frequency);
  return frequency ? (words[normalize(frequency)] ?? null) : null;
}
