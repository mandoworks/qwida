import { daysBetween, isIsoDate } from "@/lib/photo/dates";
import type { QuidaEvent } from "@/lib/store/types";
import { isoDate } from "./dates";

/** A referral gets a digest line inside this window, or when it already expired. */
const REFERIDO_WINDOW_DAYS = 30;

export type ChangeKind = "visit" | "photo" | "fence" | "weekcard" | "referido" | "appointment";
export type Change = { id: string; kind: ChangeKind; at: string };
export type NextKind = "cita" | "recarga" | "referido";
export type NextThing = { id: string; kind: NextKind; days: number; when: string; name: string | null };
export type DigestAction = { href: string; key: "fence" | "review" | "weekcard" | "reminders" | "timeline" };
export type Pending = { id: string; kind: string };

export type DigestHero = "ok" | "warn" | "fence";
export type SignalSource = "photo" | "voice" | "visit" | "caregiver" | "system";

export type Digest = {
  /** Events whose last change is newer than `seenAt`. Empty the first visit. */
  changes: Change[];
  next: NextThing[];
  /** The Fence alert shows first, above everything, in a calm red card. */
  fence: { id: string; emergency: boolean; at: string } | null;
  pending: Pending[];
  /** Exactly one suggested action, the most pressing thing. */
  action: DigestAction | null;
  quiet: boolean;
  /** ok, warn or fence: the hero of the digest card (DESIGN 4.14). */
  hero: DigestHero;
  /** Newest real signal from Doña Carmen's phone, for "Última señal". */
  lastSignal: { at: string; source: SignalSource } | null;
  /** Confirmed medicines that are close to running out. */
  refills: { id: string; drug: string; days: number; runs_out_on: string }[];
  /** Confirmed referrals inside the reminder window. */
  referred: { id: string; specialty: string | null; expires_on: string; days: number }[];
};

const CHANGE_KIND: Record<string, ChangeKind> = {
  visit: "visit",
  voice_note: "visit",
  rx_handwritten: "photo",
  rx_label: "photo",
  fence: "fence",
  weekcard: "weekcard",
  referido: "referido",
  appointment: "appointment",
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** What changed since the caregiver last looked. */
export function changesSince(events: QuidaEvent[], seenAt: string | null): Change[] {
  const seen = seenAt ? Date.parse(seenAt) : NaN;
  return events
    .filter((e) => CHANGE_KIND[e.kind])
    .filter((e) => (isNaN(seen) ? false : Date.parse(e.updatedAt) > seen))
    .map((e) => ({ id: e.id, kind: CHANGE_KIND[e.kind], at: e.updatedAt }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** The next appointment, the next refill and the referral that expires first. */
export function upcoming(events: QuidaEvent[], today: string): NextThing[] {
  const confirmed = events.filter((e) => e.status === "CONFIRMADO");
  const out: NextThing[] = [];

  const appt = confirmed
    .filter((e) => e.kind === "appointment")
    .flatMap((e) => {
      const date = str(e.payload.date);
      if (!date) return [];
      const day = isoDate(date);
      if (!day || !isIsoDate(day)) return [];
      const days = daysBetween(today, day);
      return days >= 0 ? [{ id: e.id, kind: "cita" as const, days, when: day, name: str(e.payload.specialty) }] : [];
    })
    .sort((a, b) => a.days - b.days)[0];
  if (appt) out.push(appt);

  const refill = confirmed
    .filter((e) => e.kind === "med_schedule")
    .flatMap((e) => {
      const r = e.payload.refill as { runs_out_on?: unknown } | undefined;
      const runsOut = isoDate(str(r?.runs_out_on));
      if (!runsOut || !isIsoDate(runsOut)) return [];
      const days = daysBetween(today, runsOut);
      // Only when the reminder window from W2 is open.
      if (days > 14) return [];
      return [{ id: e.id, kind: "recarga" as const, days, when: runsOut, name: str(e.payload.drug) }];
    })
    .sort((a, b) => a.days - b.days)[0];
  if (refill) out.push(refill);

  const referido = confirmed
    .filter((e) => e.kind === "referido")
    .flatMap((e) => {
      const expires = isoDate(str(e.payload.expires_on));
      if (!expires || !isIsoDate(expires)) return [];
      const days = daysBetween(today, expires);
      if (days > REFERIDO_WINDOW_DAYS) return [];
      return [{ id: e.id, kind: "referido" as const, days, when: expires, name: str(e.payload.specialty) }];
    })
    .sort((a, b) => a.days - b.days)[0];
  if (referido) out.push(referido);

  return out.sort((a, b) => a.days - b.days);
}

/** Everything a person still has to look at: no AI output becomes CONFIRMADO by itself. */
export function pendingItems(events: QuidaEvent[]): Pending[] {
  return events
    .filter((e) => e.status !== "CONFIRMADO" && e.kind !== "nudge")
    .map((e) => ({ id: e.id, kind: e.kind }));
}

function newestFence(events: QuidaEvent[]): { id: string; emergency: boolean; at: string } | null {
  const fence = events
    .filter((e) => e.kind === "fence" && e.status !== "CONFIRMADO")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!fence) return null;
  return { id: fence.id, emergency: fence.payload.emergency === true, at: fence.createdAt };
}

/** Last card sent to Mamá, used to suggest a new one once the week moves on. */
export function lastWeekcard(events: QuidaEvent[]): QuidaEvent | null {
  return (
    events
      .filter((e) => e.kind === "weekcard" && e.status === "CONFIRMADO")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

/**
 * One glance for Marisol: what changed, what is next, and exactly one thing to
 * do now. Pure, so it can be tested without a browser.
 */
export function buildDigest(events: QuidaEvent[], input: { seenAt: string | null; today: string }): Digest {
  const changes = changesSince(events, input.seenAt);
  const next = upcoming(events, input.today);
  const fence = newestFence(events);
  const pending = pendingItems(events);
  const card = lastWeekcard(events);
  const cardAge = card ? daysBetween(input.today, isoDate(card.updatedAt) ?? input.today) : null;

  let action: DigestAction | null = null;
  if (fence) action = { href: "/cuidador/revisar", key: "fence" };
  else if (pending.length) action = { href: "/cuidador/revisar", key: "review" };
  else if (cardAge === null || cardAge > 7) action = { href: "/cuidador/tarjeta", key: "weekcard" };
  else if (next.some((n) => n.kind !== "cita" && n.days <= 7)) action = { href: "/cuidador/recordatorios", key: "reminders" };
  else action = { href: "/cuidador/linea-de-tiempo", key: "timeline" };

  const hero: DigestHero = fence ? "fence" : pending.length ? "warn" : "ok";
  return {
    changes,
    next,
    fence,
    pending,
    action,
    hero,
    quiet: !fence && !pending.length && !changes.length,
    lastSignal: lastSignal(events),
    refills: refills(events, input.today),
    referred: watchlist(events, input.today),
  };
}

export function pendingCount(digest: Digest): number {
  return digest.pending.length;
}

/** Newest event that came from Doña Carmen or a photo of her papers. */
export function lastSignal(events: QuidaEvent[]): { at: string; source: SignalSource } | null {
  const newest = [...events]
    .filter((e) => e.kind !== "nudge" && e.kind !== "weekcard")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!newest) return null;
  const source =
    newest.kind === "voice_note" || newest.kind === "visit"
      ? "voice"
      : newest.kind === "rx_label" || newest.kind === "rx_handwritten"
        ? "photo"
        : newest.kind === "fence"
          ? "system"
          : newest.source;
  return { at: newest.createdAt, source };
}

/** Confirmed medicines with a refill date inside the reminder window. */
export function refills(events: QuidaEvent[], today: string): { id: string; drug: string; days: number; runs_out_on: string }[] {
  return events
    .filter((e) => e.kind === "med_schedule" && e.status === "CONFIRMADO")
    .flatMap((e) => {
      const runsOut = isoDate(str((e.payload.refill as { runs_out_on?: unknown } | undefined)?.runs_out_on));
      if (!runsOut || !isIsoDate(runsOut)) return [];
      const days = daysBetween(today, runsOut);
      if (days > 14) return [];
      return [{ id: e.id, drug: str(e.payload.drug) ?? "su medicina", days, runs_out_on: runsOut }];
    })
    .sort((a, b) => a.days - b.days);
}

/** Confirmed referrals inside the reminder window, soonest first. */
export function watchlist(events: QuidaEvent[], today: string): { id: string; specialty: string | null; expires_on: string; days: number }[] {
  return events
    .filter((e) => e.kind === "referido" && e.status === "CONFIRMADO")
    .flatMap((e) => {
      const expires = isoDate(str(e.payload.expires_on));
      if (!expires || !isIsoDate(expires)) return [];
      const days = daysBetween(today, expires);
      if (days > REFERIDO_WINDOW_DAYS) return [];
      return [{ id: e.id, specialty: str(e.payload.specialty), expires_on: expires, days }];
    })
    .sort((a, b) => a.days - b.days);
}

/** Total of confirmed appointments, for the .ics label. */
export function confirmedAppointments(events: QuidaEvent[]): QuidaEvent[] {
  return events.filter((e) => e.kind === "appointment" && e.status === "CONFIRMADO" && isoDate(str(e.payload.date)));
}

/** Confidence under this reads as "a person has to look at it". */
export function lowConfidence(e: QuidaEvent): boolean {
  return e.confidence !== null && e.confidence < 0.6;
}
