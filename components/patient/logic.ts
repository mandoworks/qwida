import { z } from "zod";
import { checkFence, normalize } from "@/lib/fence";
import type { QuidaEvent } from "@/lib/store/types";

/** "Buenos días" until noon, "Buenas tardes" until 7 pm, "Buenas noches" otherwise. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Week card (W3 writes it as a CONFIRMADO `weekcard` event)

const Hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

export const WeekCardPayload = z.object({
  title: z.string().default("Mi tarjeta de la semana"),
  theme: z.object({ primary: Hex, accent: Hex }).optional().catch(undefined),
  items: z
    .array(
      z.object({
        day: z.string(),
        time: z.string().optional(),
        text: z.string(),
        icon: z.string().optional(),
      }),
    )
    .default([]),
  questionsForDoctor: z.array(z.string()).default([]),
});
export type WeekCard = z.infer<typeof WeekCardPayload>;

/** Drops anything that reads as a medication change, whatever the sender wrote. */
function stripMedChange(card: WeekCard): { card: WeekCard; removed: boolean } {
  const bad = (s: string) => checkFence(s).medChange;
  const items = card.items.filter((i) => !bad(i.text));
  const questionsForDoctor = card.questionsForDoctor.filter((q) => !bad(q));
  const removed = items.length !== card.items.length || questionsForDoctor.length !== card.questionsForDoctor.length;
  return { card: { ...card, items, questionsForDoctor }, removed };
}

export type LatestCard = { event: QuidaEvent; card: WeekCard; removed: boolean };

/** Newest CONFIRMADO week card that parses. BORRADOR and POR_CONFIRMAR never reach Doña Carmen. */
export function latestWeekcard(events: QuidaEvent[]): LatestCard | null {
  const confirmed = events
    .filter((e) => e.kind === "weekcard" && e.status === "CONFIRMADO")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const event of confirmed) {
    const parsed = WeekCardPayload.safeParse(event.payload);
    if (parsed.success) return { event, ...stripMedChange(parsed.data) };
  }
  return null;
}

/** Changes whenever the card is replaced or edited, so "seen" resets for a new push. */
export function cardKey(event: QuidaEvent): string {
  return `${event.id}@${event.updatedAt}`;
}

/** Text for the Web Speech API: short sentences, in order. */
export function speechText(card: WeekCard): string {
  const parts = [card.title + "."];
  for (const i of card.items) {
    parts.push(`${i.day}${i.time ? `, ${i.time}` : ""}. ${i.text}.`);
  }
  if (card.questionsForDoctor.length) {
    parts.push("Para preguntarle al doctor.");
    for (const q of card.questionsForDoctor) parts.push(q);
  }
  return parts.join(" ");
}

// Theme contrast (AAA is 7:1; a theme that fails falls back to the default tokens)

function luminance(hex: string): number {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near black ink on the given background, or null if neither reaches AAA. */
export function inkOn(bg: string): string | null {
  for (const ink of ["#ffffff", "#1b1a17"]) {
    if (contrastRatio(bg, ink) >= 7) return ink;
  }
  return null;
}

// Medicines (confirmed `med_schedule` events), four daily slots

export const SLOTS = ["mañana", "mediodía", "tarde", "noche"] as const;
export type Slot = (typeof SLOTS)[number];

const SLOT_BY_NORM: Record<string, Slot> = {
  manana: "mañana",
  mediodia: "mediodía",
  tarde: "tarde",
  noche: "noche",
};

const MedPayload = z.object({
  drug: z.string(),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  slots: z.array(z.string()).default([]),
});

export type SlotMed = { id: string; drug: string; dose?: string };

export function medSlots(events: QuidaEvent[]): Record<Slot, SlotMed[]> {
  const out: Record<Slot, SlotMed[]> = { mañana: [], mediodía: [], tarde: [], noche: [] };
  for (const e of events) {
    if (e.kind !== "med_schedule" || e.status !== "CONFIRMADO") continue;
    const p = MedPayload.safeParse(e.payload);
    if (!p.success) continue;
    for (const raw of p.data.slots) {
      const slot = SLOT_BY_NORM[normalize(raw)];
      if (slot) out[slot].push({ id: e.id, drug: p.data.drug, dose: p.data.dose });
    }
  }
  return out;
}

// Notices (fence tripwire, label rescan nudge)

export type Notice =
  | { type: "fence"; id: string; emergency: boolean }
  | { type: "nudge"; id: string };

/** Newest fence event and newest nudge event that she has not dismissed. Copy is fixed elsewhere. */
export function activeNotices(events: QuidaEvent[], dismissed: ReadonlySet<string>): Notice[] {
  const out: Notice[] = [];
  const newest = (kind: "fence" | "nudge") =>
    events.filter((e) => e.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const fence = newest("fence");
  if (fence && !dismissed.has(fence.id)) {
    out.push({ type: "fence", id: fence.id, emergency: fence.payload.emergency === true });
  }
  const nudge = newest("nudge");
  if (nudge && !dismissed.has(nudge.id)) out.push({ type: "nudge", id: nudge.id });
  return out;
}
