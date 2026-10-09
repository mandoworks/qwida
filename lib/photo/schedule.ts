import type { QuidaEvent } from "@/lib/store/types";
import { daysBetween, isIsoDate } from "./dates";

export type ScheduleItem = {
  id: string;
  drug: string;
  dose: string | null;
  slots: string[];
  /** Days of pills left, from the confirmed label's refill math. Null when unknown. */
  daysLeft: number | null;
};

/** Confirmed med_schedule events as rows for MedSchedule. Unconfirmed ones never show. */
export function scheduleItems(events: QuidaEvent[], today: string): ScheduleItem[] {
  return events
    .filter((e) => e.kind === "med_schedule" && e.status === "CONFIRMADO")
    .map((e) => {
      const p = e.payload;
      const runsOut = (p.refill as { runs_out_on?: unknown } | null | undefined)?.runs_out_on;
      return {
        id: e.id,
        drug: String(p.drug ?? ""),
        dose: typeof p.dose === "string" ? p.dose : null,
        slots: Array.isArray(p.slots) ? p.slots.map(String) : [],
        daysLeft: isIsoDate(runsOut) ? Math.max(0, daysBetween(today, runsOut)) : null,
      };
    });
}
