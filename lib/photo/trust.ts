import { normalize } from "@/lib/fence";
import type { EventStatus } from "@/lib/store/types";
import type { HeardPrescription } from "@/lib/visit/schema";
import { isIsoDate } from "./dates";
import type { Field, PhotoExtraction, TrustedFields } from "./schema";

/** Printed label fields at or above this confidence are pre-filled; lower ones are highlighted. */
export const PREFILL_CONFIDENCE = 0.85;

export const HANDWRITTEN_BADGE = "Letra de médico: no confiable";
export const LABEL_RESCAN_TEXT = "Cuando recoja la receta, escanee la etiqueta de la farmacia.";

const DATE_FIELDS = new Set(["date", "issue_date"]);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** True for a 24 hour time written as HH:MM. */
export function isTime(s: unknown): s is string {
  return typeof s === "string" && TIME.test(s);
}

/** Clamp confidence and drop malformed dates and times: the model's word is never taken as is. */
export function sanitize(name: string, f: Field): Field {
  const confidence = Math.min(1, Math.max(0, Number.isFinite(f.confidence) ? f.confidence : 0));
  if (DATE_FIELDS.has(name) && f.value !== null && !isIsoDate(f.value)) {
    return { ...f, value: null, confidence: 0 };
  }
  if (name === "time" && f.value !== null && !isTime(f.value)) {
    return { ...f, value: null, confidence: 0 };
  }
  if (f.value === null || f.value === "") return { ...f, value: null, confidence: 0 };
  return { ...f, confidence };
}

function trustFields(raw: Record<string, Field>, handwritten: boolean): TrustedFields {
  const out: TrustedFields = {};
  for (const [name, f] of Object.entries(raw)) {
    const s = sanitize(name, f);
    const prefill = !handwritten && s.value !== null && s.confidence >= PREFILL_CONFIDENCE;
    out[name] = { ...s, prefill, highlight: !prefill };
  }
  return out;
}

/**
 * First word of a drug name, without accents or a final vowel: "Losartán potásico" and
 * "losartan" match, and so do English and Spanish spellings ("omeprazole", "omeprazol";
 * "amlodipine", "amlodipino"; "metformin", "metformina").
 */
export function drugKey(s: string): string {
  return (normalize(s).split(" ")[0] ?? "").replace(/[aeo]$/, "");
}

/** "50 mg", "50 miligramos" and "50mg" compare equal. Returns null when no number is present. */
export function doseKey(s: string): { n: number; unit: string | null } | null {
  const norm = normalize(s.replace(/(\d),(\d)/g, "$1.$2")).replace(/miligramos?|milligrams?/g, "mg").replace(/microgramos?|micrograms?/g, "mcg");
  const m = norm.match(/(\d+(?:\.\d+)?)\s*(mcg|mg|g|ml|unidades)?/);
  return m ? { n: Number(m[1]), unit: m[2] ?? null } : null;
}

function sameDose(a: string, b: string): boolean {
  const x = doseKey(a);
  const y = doseKey(b);
  if (!x || !y) return true; // nothing comparable, nothing to flag
  return x.n === y.n && (x.unit === null || y.unit === null || x.unit === y.unit);
}

/**
 * Compares a printed label against what the doctor said in the latest visit.
 * Drug not mentioned, or a different strength, marks the field for a person to decide.
 */
export function crossCheck(fields: TrustedFields, visit: HeardPrescription[] | undefined): TrustedFields {
  const drug = fields.drug?.value;
  if (!visit?.length || typeof drug !== "string") return fields;
  const out = { ...fields };
  const heard = visit.find((p) => p.drug && drugKey(p.drug) === drugKey(drug));
  if (!heard) {
    const names = visit.map((p) => p.drug).filter(Boolean).join(", ");
    out.drug = { ...out.drug, highlight: true, mismatch: { visit: names || "sin nombre", note: "No se mencionó en la visita grabada." } };
    return out;
  }
  const strength = out.strength?.value;
  if (out.strength && heard.dose && typeof strength === "string" && !sameDose(strength, heard.dose)) {
    out.strength = { ...out.strength, highlight: true, mismatch: { visit: heard.dose, note: "En la visita se oyó otra dosis." } };
  }
  return out;
}

export type TrustResult = {
  trusted: boolean;
  badge: string | null;
  status: EventStatus;
  fields: TrustedFields | null;
  /** Only a confirmed printed label may become a med schedule. */
  canSchedule: boolean;
};

/** Deterministic trust rules for one photo. The model only reads; this decides what is believed. */
/**
 * A pharmacy label always prints the pharmacy and an Rx number. A "label" with neither
 * is a prescription pad the model misread, so it is treated as handwriting: never trusted.
 */
export function guardClass(x: PhotoExtraction): PhotoExtraction {
  const p = x.prescription;
  if (x.class !== "rx_label" || !p) return x;
  return p.pharmacy.value || p.rx_number.value ? x : { ...x, class: "rx_handwritten" };
}

export function applyTrust(x: PhotoExtraction, visit?: HeardPrescription[]): TrustResult {
  switch (x.class) {
    case "rx_handwritten":
      return {
        trusted: false,
        badge: HANDWRITTEN_BADGE,
        status: "POR_CONFIRMAR",
        fields: x.prescription ? trustFields(x.prescription, true) : null,
        canSchedule: false,
      };
    case "rx_label":
      return {
        trusted: true,
        badge: null,
        status: "POR_CONFIRMAR",
        fields: x.prescription ? crossCheck(trustFields(x.prescription, false), visit) : null,
        canSchedule: true,
      };
    case "referido":
      return {
        trusted: true,
        badge: null,
        status: "POR_CONFIRMAR",
        fields: x.referido ? trustFields(x.referido, false) : null,
        canSchedule: false,
      };
    case "appointment_slip":
      // Cards are often filled in by hand at the front desk: only confident fields pre-fill.
      return {
        trusted: true,
        badge: null,
        status: "POR_CONFIRMAR",
        fields: x.appointment ? trustFields(x.appointment, false) : null,
        canSchedule: false,
      };
    default:
      return { trusted: false, badge: null, status: "POR_CONFIRMAR", fields: null, canSchedule: false };
  }
}

export const SLOTS = ["mañana", "mediodía", "tarde", "noche"] as const;
export type Slot = (typeof SLOTS)[number];

const COUNT_RULES: [number, RegExp][] = [
  [4, /\b(?:cuatro veces|4 veces|cada 6 horas|qid|four times)\b/],
  [3, /\b(?:tres veces|3 veces|cada 8 horas|tid|three times)\b/],
  [2, /\b(?:dos veces|2 veces|cada 12 horas|bid|twice)\b/],
  [1, /\b(?:una vez|1 vez|diari[ao]|cada 24 horas|cada dia|todos los dias|qd|once daily|once a day|daily)\b/],
];

const TIME_OF_DAY: [Slot, RegExp][] = [
  ["mañana", /\b(?:manana|desayuno|ayunas|morning)\b/],
  ["mediodía", /\b(?:mediodia|almuerzo|noon)\b/],
  ["tarde", /\b(?:tarde|afternoon)\b/],
  ["noche", /\b(?:noche|acostarse|dormir|night|bedtime)\b/],
];

const BY_COUNT: Record<number, Slot[]> = {
  1: ["mañana"],
  2: ["mañana", "noche"],
  3: ["mañana", "mediodía", "noche"],
  4: ["mañana", "mediodía", "tarde", "noche"],
};

/**
 * Daily slots from the label's frequency. Once a day goes to mañana unless the
 * label names another time ("en la noche"). Returns null when the count is unknown
 * or the text and the number disagree: then the app asks, it never guesses.
 */
export function deriveSlots(frequency: string | null, timesPerDay: number | null): Slot[] | null {
  const norm = frequency ? normalize(frequency) : "";
  const named = TIME_OF_DAY.filter(([, re]) => re.test(norm)).map(([slot]) => slot);
  let fromText = COUNT_RULES.find(([, re]) => re.test(norm))?.[0] ?? null;
  if (fromText === null && named.length === 1) fromText = 1;

  const fromNumber = timesPerDay !== null && Number.isInteger(timesPerDay) ? timesPerDay : null;
  if (fromText !== null && fromNumber !== null && fromText !== fromNumber) return null;
  const count = fromNumber ?? fromText;
  if (count === null || !BY_COUNT[count]) return null;
  if (count === 1 && named.length === 1) return named;
  return BY_COUNT[count];
}
