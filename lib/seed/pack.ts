import type { NewEvent } from "@/lib/store/types";
import carmen from "@/data/synthetic/households/carmen.json";
import maria from "@/data/synthetic/households/maria.json";
import rosa from "@/data/synthetic/households/rosa.json";
import ramon from "@/data/synthetic/households/ramon.json";
import rafael from "@/data/synthetic/households/rafael.json";

/**
 * The synthetic pack (data/synthetic). Every person, doctor, pharmacy and plan
 * in it is fictional. Dates are stored relative to today so the demo stays current:
 * `{ "$days": n }` is today plus n days at 10:00 local (ISO), `{ "$date": n }` is
 * today plus n days as YYYY-MM-DD.
 */
type PackEvent = Omit<NewEvent, "householdId">;
export type Household = {
  synthetic: true;
  householdId: string;
  tier: "golden" | "top5";
  voiceId: string;
  persona: Record<string, unknown>;
  story: string;
  events: PackEvent[];
};

export const HOUSEHOLDS = { carmen, maria, rosa, ramon, rafael } as unknown as Record<string, Household>;
export type HouseholdKey = keyof typeof HOUSEHOLDS;

function shift(days: number, now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

function resolve(value: unknown, now: Date): unknown {
  if (Array.isArray(value)) return value.map((v) => resolve(v, now));
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.$days === "number") {
      const d = shift(o.$days, now);
      d.setHours(10, 0, 0, 0);
      return d.toISOString();
    }
    if (typeof o.$date === "number") return shift(o.$date, now).toISOString().slice(0, 10);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, resolve(v, now)]));
  }
  return value;
}

/** One household's events, dates resolved against `now`. */
export function householdEvents(key: string, now = new Date()): NewEvent[] {
  const h = HOUSEHOLDS[key];
  if (!h) throw new Error(`unknown synthetic household: ${key}`);
  return h.events.map((e) => ({ ...(resolve(e, now) as PackEvent), householdId: h.householdId }));
}
