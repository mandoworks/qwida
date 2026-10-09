import type { NewEvent } from "@/lib/store/types";

/**
 * Synthetic demo case. Every person, doctor, pharmacy and plan here is fictional.
 * Data from the W7 synthetic lane replaces these values when it lands.
 */
export const HOUSEHOLD_ID = "demo-carmen";

export const persona = {
  synthetic: true,
  patient: { name: "Carmen Rivera", display: "Doña Carmen", age: 78, town: "Adjuntas" },
  caregiver: { name: "Marisol Rivera", relation: "hija", city: "Orlando" },
  plan: { name: "Plan Vital", type: "MCO", fictional: true },
} as const;

/** Days from today at 10:00 local, as an ISO date string. Keeps the demo current. */

/** Days from today as a YYYY-MM-DD date string (for referido expiry). */
function dateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export function seedEvents(): NewEvent[] {
  return [
    {
      householdId: HOUSEHOLD_ID,
      kind: "med_schedule",
      status: "CONFIRMADO",
      source: "caregiver",
      confidence: 1,
      payload: {
        synthetic: true,
        drug: "metformina",
        dose: "500 mg",
        frequency: "dos veces al día, con comida",
        slots: ["mañana", "noche"],
        // Runs out inside the 14 day window so Recordatorios and the digest show a refill.
        refill: { runs_out_on: dateFromNow(5) },
      },
    },
    {
      householdId: HOUSEHOLD_ID,
      kind: "med_schedule",
      status: "CONFIRMADO",
      source: "caregiver",
      confidence: 1,
      payload: {
        synthetic: true,
        drug: "amlodipino",
        dose: "5 mg",
        frequency: "una vez al día",
        slots: ["mañana"],
      },
    },
    {
      householdId: HOUSEHOLD_ID,
      kind: "appointment",
      status: "CONFIRMADO",
      source: "caregiver",
      confidence: 1,
      payload: {
        synthetic: true,
        specialty: "cardiología",
        doctor: "Dra. Isabel Montalvo (ficticia)",
        place: "Centro Cardiovascular de Utuado (ficticio)",
        date: daysFromNow(9),
        plan: persona.plan.name,
      },
    },
    {
      householdId: HOUSEHOLD_ID,
      kind: "referido",
      status: "CONFIRMADO",
      source: "caregiver",
      confidence: 1,
      payload: {
        synthetic: true,
        specialty: "cardiología",
        doctor: "Dra. Isabel Montalvo (ficticia)",
        issued_on: dateFromNow(-45),
        expires_on: dateFromNow(45),
        plan: persona.plan.name,
      },
    },
  ];
}
