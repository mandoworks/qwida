import { normalize } from "@/lib/fence";
import { daysBetween } from "@/lib/photo/dates";
import type { EventStatus, QuidaEvent } from "@/lib/store/types";
import { whenLabel } from "./dates";

export type TimelineGroup = "cita" | "receta" | "referido" | "nota" | "alerta" | "otro";
/** The groups a caregiver can filter by. "otro" has no chip, it is the rest. */
export const TIMELINE_GROUPS: TimelineGroup[] = ["cita", "receta", "referido", "nota", "alerta"];

/**
 * "nota" is the voice filter: what Doña Carmen said out loud, either a voice
 * note or a recorded visit. The sent card and the reminders are Qwida's own
 * output, so they sit in "otro" and never show up under NOTAS DE VOZ.
 */
const GROUP_OF: Record<string, TimelineGroup> = {
  appointment: "cita",
  rx_handwritten: "receta",
  rx_label: "receta",
  med_schedule: "receta",
  referido: "referido",
  visit: "nota",
  voice_note: "nota",
  weekcard: "otro",
  nudge: "otro",
  fence: "alerta",
};

export type TimelineRow = {
  id: string;
  group: TimelineGroup;
  status: EventStatus;
  at: string;
  /** Data derived Spanish text, for example "Cita de cardiología". */
  title: string;
  /** Extra facts already computed, so the row is a pure function of the event. */
  facts: { key: "doctor" | "place" | "specialty" | "date" | "expires" | "prescriptions" | "questions" | "drug" | "source" | "days"; value: string }[];
  /** Matches the specialty text filter. */
  search: string;
  /** Where it came from, for the small source line (4.12). */
  source: "photo" | "voice" | "visit" | "caregiver" | "system";
  /** The paper trail line: the person who confirmed it, when, and from which device. */
  confirmed: { by: "patient" | "caregiver"; name: string | null; device: string | null; at: string } | null;
  /** On a recorded visit: both people consented, when, and from which device. */
  consent: { at: string; device: string | null } | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function factsFor(e: QuidaEvent): TimelineRow["facts"] {
  const p = e.payload;
  const facts: TimelineRow["facts"] = [];
  const push = (key: TimelineRow["facts"][number]["key"], value: string | null | undefined) => {
    if (value) facts.push({ key, value });
  };
  if (e.kind === "appointment") {
    push("specialty", str(p.specialty));
    push("doctor", str(p.doctor));
    push("place", str(p.place));
    // Readable Spanish, never the raw ISO the store holds.
    push("date", whenLabel(str(p.date)));
  } else if (e.kind === "referido") {
    push("specialty", str(p.specialty));
    push("expires", str(p.expires_on));
    push("doctor", str(p.referring_doctor));
  } else if (e.kind === "med_schedule") {
    push("drug", [str(p.drug), str(p.dose)].filter(Boolean).join(" "));
    push("specialty", str(p.pharmacy));
  } else if (e.kind === "rx_handwritten" || e.kind === "rx_label") {
    const fields = (p.fields ?? {}) as Record<string, { value?: unknown }>;
    const read = (k: string) => str(fields[k]?.value);
    push("drug", [read("drug"), read("strength")].filter(Boolean).join(" "));
    push("specialty", read("specialty"));
    push("place", read("pharmacy"));
  } else if (e.kind === "visit") {
    const prescriptions = Array.isArray(p.prescriptions) ? p.prescriptions.length : 0;
    const questions = Array.isArray(p.questions_back) ? p.questions_back.length : 0;
    push("prescriptions", prescriptions ? String(prescriptions) : null);
    push("questions", questions ? String(questions) : null);
    const specialty = str(p.specialty);
    push("specialty", specialty);
  } else if (e.kind === "voice_note") {
    push("source", str(p.text));
  } else if (e.kind === "weekcard") {
    const items = Array.isArray(p.items) ? p.items.length : 0;
    push("prescriptions", items ? String(items) : null);
  } else if (e.kind === "fence") {
    push("source", str(p.context));
  } else if (e.kind === "nudge") {
    push("source", str(p.text));
  }
  return facts;
}

function titleFor(e: QuidaEvent, facts: TimelineRow["facts"]): string {
  const value = (key: TimelineRow["facts"][number]["key"]) =>
    facts.find((f) => f.key === key)?.value ?? null;
  switch (GROUP_OF[e.kind]) {
    case "cita":
      return `Cita de ${value("specialty") ?? "seguimiento"}`;
    case "receta":
      return e.kind === "med_schedule" ? `Horario confirmado: ${value("drug") ?? "medicamento"}` : `Receta: ${value("drug") ?? "sin nombre"}`;
    case "referido":
      return `Referido de ${value("specialty") ?? "especialidad"}`;
    case "alerta":
      return e.payload.emergency === true ? "Alerta: palabras de emergencia" : "Alerta: cambio de medicina";
    default:
      if (e.kind === "visit") return "Grabación de la visita";
      if (e.kind === "voice_note") return "Nota de voz";
      if (e.kind === "weekcard") return "Tarjeta de la semana";
      return "Recordatorio";
  }
}

/** Where the row came from, for the small source line under it (DESIGN 4.12). */
export function sourceKey(e: QuidaEvent): "photo" | "voice" | "visit" | "caregiver" | "system" {
  if (e.kind === "voice_note") return "voice";
  if (e.kind === "visit") return "visit";
  if (e.kind === "rx_label" || e.kind === "rx_handwritten") return "photo";
  if (e.source === "system") return "system";
  return "caregiver";
}

export type DayGroup = {
  /** YYYY-MM-DD of the day, in Puerto Rico time. */
  date: string;
  today: boolean;
  yesterday: boolean;
  rows: TimelineRow[];
};

/**
 * Rows grouped by day, newest day first, for the sticky day headers in 4.12.
 * The label stays in the component so it can come from the dictionary.
 */
export function groupByDay(rows: TimelineRow[], today: string): DayGroup[] {
  const groups = new Map<string, TimelineRow[]>();
  for (const row of rows) {
    const date = isoDatePR(row.at);
    groups.set(date, [...(groups.get(date) ?? []), row]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayRows]) => {
      const diff = daysBetween(date, today);
      return { date, today: diff === 0, yesterday: diff === 1, rows: dayRows };
    });
}

/** YYYY-MM-DD in Puerto Rico, so day headers match the patient's calendar. */
function isoDatePR(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date(iso));
}

/** Every event, newest first, with the text the specialty filter searches in. */
const role = (v: unknown) => (v === "patient" || v === "caregiver" ? v : null);

/** The last person confirmation in the history, or the stamp itself on events written before the history existed. */
function confirmedOf(e: QuidaEvent): TimelineRow["confirmed"] {
  if (e.status !== "CONFIRMADO") return null;
  const history = Array.isArray(e.payload.history) ? (e.payload.history as Record<string, unknown>[]) : [];
  const last = [...history].reverse().find((h) => h.status === "CONFIRMADO" && role(h.by));
  const src = last ?? { by: e.payload.confirmedBy, name: e.payload.confirmedName, device: e.payload.confirmedDevice, at: e.payload.confirmedAt };
  const by = role(src.by);
  const at = str(src.at);
  if (!by || !at) return null;
  return { by, name: str(src.name), device: str(src.device), at };
}

function consentOf(e: QuidaEvent): TimelineRow["consent"] {
  const c = e.kind === "visit" ? (e.payload.consent as Record<string, unknown> | null | undefined) : null;
  const at = c && c.patient === true && c.doctor === true ? str(c.at) : null;
  return at ? { at, device: str(c?.device) } : null;
}

export function timelineRows(events: QuidaEvent[]): TimelineRow[] {
  return events
    // The BORRADOR weekcard is the editor autosave, not care history.
    .filter((e) => GROUP_OF[e.kind] && !(e.kind === "weekcard" && e.status !== "CONFIRMADO"))
    .map((e) => {
      const facts = factsFor(e);
      const group = GROUP_OF[e.kind];
      const search = normalize([titleFor(e, facts), ...facts.map((f) => f.value)].join(" "));
      return {
        id: e.id,
        group,
        status: e.status,
        at: e.createdAt,
        title: titleFor(e, facts),
        facts,
        search,
        source: sourceKey(e),
        confirmed: confirmedOf(e),
        consent: consentOf(e),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** `group` is "all" or one of TIMELINE_GROUPS; `specialty` is free text ("cardiología"). */
export function filterRows(rows: TimelineRow[], group: TimelineGroup | "all", specialty: string): TimelineRow[] {
  const needle = normalize(specialty);
  return rows.filter(
    (r) => (group === "all" || r.group === group) && (needle === "" || r.search.includes(needle)),
  );
}
