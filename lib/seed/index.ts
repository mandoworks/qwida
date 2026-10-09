import type { NewEvent } from "@/lib/store/types";

/**
 * Synthetic demo case. Every person, doctor, pharmacy and plan here is fictional.
 * Data from the W7 synthetic lane replaces these values when it lands.
 */
export const HOUSEHOLD_ID = "demo-carmen";

export const persona = {
  synthetic: true,
  patient: { name: "Carmen Rivera", display: "Doña Carmen", age: 78, town: "Adjuntas" },
  familia: { name: "Marisol Rivera", relation: "hija", city: "Orlando" },
  plan: { name: "Plan Vital", type: "MCO", fictional: true },
} as const;

/** Days from today at 10:00 local, as an ISO date string. Keeps the demo current. */
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
      source: "familia",
      confidence: 1,
      payload: {
        synthetic: true,
        drug: "metformina",
        dose: "500 mg",
        frequency: "dos veces al día, con comida",
        slots: ["mañana", "noche"],
      },
    },
    {
      householdId: HOUSEHOLD_ID,
      kind: "med_schedule",
      status: "CONFIRMADO",
      source: "familia",
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
      source: "familia",
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
  ];
}
