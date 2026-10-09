import { addDays, daysBetween, isIsoDate } from "./dates";

/** Remind the family member this many days before the pills run out. */
export const REFILL_REMIND_DAYS = 7;

export type RefillCountdown = {
  /** Days the fill lasts at the confirmed schedule. */
  days_supply: number;
  /** First day without pills, YYYY-MM-DD. */
  runs_out_on: string;
  /** Day to remind the family member, YYYY-MM-DD. */
  remind_on: string;
  /** Days of pills left as of `today`, never negative. */
  days_left: number;
  /** True from `remind_on` onward. */
  remind_now: boolean;
};

/**
 * Pure refill math from a confirmed schedule: quantity dispensed, units taken
 * per day, fill date. Returns null when any input is missing or not usable.
 */
export function refillCountdown(input: {
  quantity: number | null;
  perDay: number | null;
  fillDate: string | null;
  today: string;
}): RefillCountdown | null {
  const { quantity, perDay, fillDate, today } = input;
  if (!quantity || quantity <= 0 || !perDay || perDay <= 0 || !isIsoDate(fillDate) || !isIsoDate(today)) {
    return null;
  }
  const days_supply = Math.floor(quantity / perDay);
  const runs_out_on = addDays(fillDate, days_supply);
  const remind_on = addDays(runs_out_on, -REFILL_REMIND_DAYS);
  return {
    days_supply,
    runs_out_on,
    remind_on,
    days_left: Math.max(0, daysBetween(today, runs_out_on)),
    remind_now: daysBetween(today, remind_on) <= 0,
  };
}

/** Units per dose from the label's dose text: "1 tableta" is 1, "2 tabletas" is 2, "media" is 0.5. */
export function unitsPerDose(dose: string | null): number {
  if (!dose) return 1;
  if (/\bmedia\b|\bhalf\b|1\/2/i.test(dose)) return 0.5;
  const n = dose.match(/\d+(?:[.,]\d+)?/);
  return n ? Number(n[0].replace(",", ".")) : 1;
}
