import type { NewEvent } from "@/lib/store/types";
import { householdEvents } from "./pack";

/**
 * Synthetic demo case. Every person, doctor, pharmacy and plan here is fictional.
 * Events come from the synthetic pack in data/synthetic (see lib/seed/pack.ts).
 */
export const HOUSEHOLD_ID = "demo-carmen";

export const persona = {
  synthetic: true,
  patient: { name: "Carmen Rivera", display: "Doña Carmen", age: 78, town: "Adjuntas" },
  caregiver: { name: "Marisol Rivera", relation: "hija", city: "Orlando" },
  plan: { name: "Plan Vital", type: "MCO", fictional: true },
} as const;

/** Doña Carmen's golden path, from the synthetic pack (data/synthetic/households/carmen.json). */
export function seedEvents(): NewEvent[] {
  return householdEvents("carmen");
}
