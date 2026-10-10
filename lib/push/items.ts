import { FENCE_COPY } from "@/lib/fence/copy";
import type { QuidaEvent } from "@/lib/store/types";

/**
 * One caregiver alert. `tag` is stable per event and item, so a second push for
 * the same thing replaces the first instead of stacking another card on the
 * lock screen.
 */
export type PushItem = {
  tag: string;
  title: string;
  body: string;
  /** Where a tap lands. Always a caregiver screen. */
  url: string;
};

const REVIEW = "/familia/revisar";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * A value the caregiver is meant to act on, read the way that event kind stores
 * it: flat on a visit child, nested under `fields` on a photo, either for dates.
 */
function valueOf(payload: Record<string, unknown>, name: string): string | null {
  const flat = str(payload[name]);
  if (flat) return flat;
  const fields = payload.fields;
  if (typeof fields !== "object" || fields === null) return null;
  const field = (fields as Record<string, unknown>)[name];
  if (typeof field !== "object" || field === null) return null;
  return str((field as Record<string, unknown>).value);
}

/**
 * The Fence alert, with the fixed copy verbatim. It is never paraphrased, and
 * the strings come from the event the server already wrote.
 */
function fenceItems(event: QuidaEvent): PushItem[] {
  const payload = event.payload;
  const emergency = payload.emergency === true;
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  if (!emergency && matches.length === 0) return [];
  const copy = Array.isArray(payload.copy) ? payload.copy.map(str).filter((c): c is string => c !== null) : [];
  const body = copy[0] ?? (emergency ? FENCE_COPY.emergency : FENCE_COPY.medChange);
  return [
    {
      tag: `${event.id}:fence`,
      title: emergency ? "Revise esto ahora: 911" : "Revise esto ahora",
      body,
      url: REVIEW,
    },
  ];
}

/**
 * One alert per thing the recording said, not one alert for the whole visit. A
 * visit that carries two medicines, a referral and a follow up date is four
 * separate things for the caregiver to act on, and her phone should say so.
 */
function visitItems(event: QuidaEvent): PushItem[] {
  const out: PushItem[] = [];
  const prescriptions = Array.isArray(event.payload.prescriptions) ? event.payload.prescriptions : [];
  prescriptions.forEach((p, i) => {
    if (typeof p !== "object" || p === null) return;
    const rx = p as Record<string, unknown>;
    const drug = str(rx.drug);
    if (!drug) return;
    const dose = str(rx.dose);
    out.push({
      tag: `${event.id}:rx:${i}`,
      title: rx.needs_confirmation === true ? "Medicina nueva, falta un dato" : "Medicina nueva",
      body: `${drug}${dose ? ` ${dose}` : ""}. Confirme la dosis antes de mandársela a Mamá.`,
      url: REVIEW,
    });
  });

  const questions = Array.isArray(event.payload.questions_back) ? event.payload.questions_back : [];
  const first = questions.map(str).find((q): q is string => q !== null);
  if (first) {
    out.push({
      tag: `${event.id}:q`,
      title: questions.length === 1 ? "Una pregunta para usted" : `${questions.length} preguntas para usted`,
      body: first,
      url: REVIEW,
    });
  }

  return out;
}

/** Alerts for the events a photo or a recording produced, by kind. */
function thingItems(event: QuidaEvent): PushItem[] {
  switch (event.kind) {
    case "rx_handwritten":
      return [
        {
          tag: `${event.id}:rx`,
          title: "Letra de médico, no confiable",
          body: "No pudimos leer la dosis. Pida la etiqueta de la farmacia y mándela como foto.",
          url: REVIEW,
        },
      ];
    case "rx_label": {
      const drug = valueOf(event.payload, "drug");
      return [
        {
          tag: `${event.id}:rx`,
          title: "Receta lista para revisar",
          body: `${drug ?? "Una receta"} de la farmacia. Confirme la dosis para crear el horario.`,
          url: REVIEW,
        },
      ];
    }
    case "referido": {
      const specialty = valueOf(event.payload, "specialty");
      const expires = str(event.payload.expires_on);
      return [
        {
          tag: `${event.id}:ref`,
          title: "Hay un referido",
          body: `${specialty ?? "Un referido"}${expires ? `, vence el ${expires}` : ""}. Confírmelo para empezar los 90 días.`,
          url: REVIEW,
        },
      ];
    }
    case "appointment": {
      const when = valueOf(event.payload, "date") ?? str(event.payload.date_text);
      if (!when) return [];
      return [
        {
          tag: `${event.id}:appt`,
          title: "Hablan de otra cita",
          body: `El médico dijo: ${when}. Confirme el día exacto con la oficina.`,
          url: REVIEW,
        },
      ];
    }
    case "voice_note": {
      const text = str(event.payload.text);
      return [
        {
          tag: `${event.id}:note`,
          title: "Mamá dejó una nota",
          body: text ? `"${text.slice(0, 120)}"` : "Hay una nota de voz nueva para revisar.",
          url: REVIEW,
        },
      ];
    }
    default:
      return [];
  }
}

/** Alerts for one event. Nothing for state the caregiver does not act on. */
export function itemsForEvent(event: QuidaEvent): PushItem[] {
  if (event.kind === "fence") return fenceItems(event);
  if (event.kind === "visit") return visitItems(event);
  return thingItems(event);
}

/**
 * Alerts for freshly created events, one per thing, oldest first so the
 * caregiver reads them in the order they happened.
 */
export function itemsForEvents(events: QuidaEvent[]): PushItem[] {
  const out: PushItem[] = [];
  const seen = new Set<string>();
  for (const event of [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    for (const item of itemsForEvent(event)) {
      if (seen.has(item.tag)) continue;
      seen.add(item.tag);
      out.push(item);
    }
  }
  return out;
}
