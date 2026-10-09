import type { PhotoClass, PhotoExtraction, PrescriptionFields } from "./schema";

/**
 * SIMULADO fixtures used when there is no AI Gateway key or the call fails.
 * Synthetic: the doctors, the pharmacy and the plan are fictional.
 */
const f = (value: string | null, confidence: number, source_text: string) => ({ value, confidence, source_text });
const n = (value: number | null, confidence: number, source_text: string) => ({ value, confidence, source_text });

const NO_PHARMACY = { pharmacy: f(null, 0, ""), rx_number: f(null, 0, "") } satisfies Partial<PrescriptionFields>;

/** Handwritten losartán 50 mg; the instructions line cannot be read. */
export const FIXTURE_HANDWRITTEN: PhotoExtraction = {
  class: "rx_handwritten",
  prescription: {
    drug: f("losartán", 0.62, "Losartan"),
    strength: f("50 mg", 0.55, "50mg"),
    dose: f(null, 0, "[ilegible]"),
    frequency: f(null, 0, "[ilegible]"),
    times_per_day: n(null, 0, "[ilegible]"),
    quantity: n(30, 0.4, "#30"),
    refills: n(null, 0, ""),
    prescriber: f("Dr. Ramón Feliciano (ficticio)", 0.5, "Dr. R. Feliciano"),
    ...NO_PHARMACY,
    date: f("2026-10-09", 0.45, "9/10/26"),
  },
  referido: null,
  appointment: null,
  unreadable_lines: ["Línea 3: indicaciones ilegibles"],
};

/** The printed label for the same prescription, picked up at the pharmacy. */
export const FIXTURE_LABEL: PhotoExtraction = {
  class: "rx_label",
  prescription: {
    drug: f("losartán", 0.97, "LOSARTAN POTASSIUM"),
    strength: f("50 mg", 0.96, "50 MG"),
    dose: f("1 tableta", 0.94, "TOME 1 TABLETA"),
    frequency: f("una vez al día", 0.93, "POR BOCA UNA VEZ AL DIA"),
    times_per_day: n(1, 0.92, "UNA VEZ AL DIA"),
    quantity: n(30, 0.95, "QTY: 30"),
    refills: n(2, 0.9, "REFILLS: 2"),
    prescriber: f("Dr. Ramón Feliciano (ficticio)", 0.78, "DR R FELICIANO"),
    pharmacy: f("Farmacia Cocotero (ficticia)", 0.96, "FARMACIA COCOTERO (FICTICIA)"),
    rx_number: f("000123", 0.98, "RX# 000123"),
    date: f("2026-10-09", 0.95, "10/09/2026"),
  },
  referido: null,
  appointment: null,
  unreadable_lines: [],
};

/** Referido to cardiology issued today in the demo. Expires 90 days later. */
export const FIXTURE_REFERIDO: PhotoExtraction = {
  class: "referido",
  prescription: null,
  referido: {
    specialty: f("cardiología", 0.95, "CARDIOLOGIA"),
    issue_date: f("2026-10-09", 0.92, "09/oct/2026"),
    referring_doctor: f("Dra. Ana Lugo (ficticia)", 0.8, "Dra. A. Lugo"),
    plan: f("Plan de Salud Isla (ficticio)", 0.9, "PLAN DE SALUD ISLA (FICTICIO)"),
  },
  appointment: null,
  unreadable_lines: [],
};

/**
 * The cardiology appointment card for that referido. Date and place are
 * printed; the phone was written by hand at the front desk.
 */
export const FIXTURE_APPOINTMENT: PhotoExtraction = {
  class: "appointment_slip",
  prescription: null,
  referido: null,
  appointment: {
    date: f("2026-11-03", 0.93, "MARTES 3 NOV 2026"),
    time: f("10:30", 0.9, "10:30 AM"),
    specialty: f("cardiología", 0.95, "CARDIOLOGIA"),
    doctor: f("Dra. Isabel Montalvo (ficticia)", 0.88, "DRA. I. MONTALVO"),
    place: f("Centro Cardiovascular de Utuado (ficticio)", 0.9, "CENTRO CARDIOVASCULAR DE UTUADO (FICTICIO)"),
    phone: f(null, 0.3, "787 55_ ____"),
  },
  unreadable_lines: ["Teléfono escrito a mano: no se lee completo"],
};

export const FIXTURES: Partial<Record<PhotoClass, PhotoExtraction>> = {
  rx_handwritten: FIXTURE_HANDWRITTEN,
  rx_label: FIXTURE_LABEL,
  referido: FIXTURE_REFERIDO,
  appointment_slip: FIXTURE_APPOINTMENT,
};

/**
 * Demo order when no hint is given, as [event kind saved, fixture]:
 * handwritten, then its label, then the referido, then the appointment card.
 */
const DEMO_ORDER = [
  ["rx_handwritten", "rx_handwritten"],
  ["rx_label", "rx_label"],
  ["referido", "referido"],
  ["appointment", "appointment_slip"],
] as const;

/**
 * Fixture for a hint, or the next step of the demo story given what the
 * household already has, so the simulated demo is deterministic.
 */
export function pickFixture(hint: string | null, seenKinds: Set<string>): PhotoExtraction {
  if (hint && FIXTURES[hint as PhotoClass]) return FIXTURES[hint as PhotoClass]!;
  const next = DEMO_ORDER.find(([kind]) => !seenKinds.has(kind))?.[1] ?? "rx_label";
  return FIXTURES[next]!;
}
