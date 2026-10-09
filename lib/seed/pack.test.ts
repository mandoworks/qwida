import { describe, expect, it } from "vitest";
import fenceCases from "@/data/synthetic/cases/fence.json";
import { checkFence } from "@/lib/fence";
import { refillCountdown, unitsPerDose } from "@/lib/photo/refill";
import { NewEvent } from "@/lib/store/types";
import { HOUSEHOLD_ID, seedEvents } from "./index";
import { HOUSEHOLDS, householdEvents } from "./pack";

const NOW = new Date("2026-10-09T15:00:00.000Z");
const today = NOW.toISOString().slice(0, 10);

describe("synthetic households", () => {
  const keys = Object.keys(HOUSEHOLDS);

  it("has the golden path plus the top 5 personas, each with its own household id", () => {
    expect(keys).toEqual(["carmen", "maria", "rosa", "ramon", "rafael"]);
    const ids = keys.map((k) => HOUSEHOLDS[k].householdId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HOUSEHOLDS.carmen.householdId).toBe(HOUSEHOLD_ID);
  });

  it.each(keys)("%s: every event parses, is synthetic, and has no unresolved date token", (key) => {
    for (const e of householdEvents(key, NOW)) {
      expect(() => NewEvent.parse(e)).not.toThrow();
      expect(e.payload.synthetic).toBe(true);
      expect(JSON.stringify(e)).not.toMatch(/"\$(days|date)"/);
    }
  });

  it.each(keys)("%s: CONFIRMADO only on caregiver records with full confidence", (key) => {
    for (const e of householdEvents(key, NOW).filter((x) => x.status === "CONFIRMADO")) {
      expect(e.source).toBe("caregiver");
      expect(e.confidence).toBe(1);
    }
  });

  it("seeds Doña Carmen from the pack with Dra. Ferrer in Ponce and a live referido", () => {
    const events = seedEvents();
    expect(events.every((e) => e.householdId === HOUSEHOLD_ID)).toBe(true);
    const referido = events.find((e) => e.kind === "referido");
    expect(referido?.payload.doctor).toBe("Dra. Isabel Ferrer (ficticia)");
    expect(String(referido?.payload.expires_on) > new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it("Don Rafael has about 3 days of pills left and the reminder is due", () => {
    const med = householdEvents("rafael", NOW).find((e) => e.kind === "med_schedule")!;
    const p = med.payload as { quantity: number; fill_date: string; dose: string; slots: string[] };
    const r = refillCountdown({ quantity: p.quantity, perDay: p.slots.length * unitsPerDose("1 tableta"), fillDate: p.fill_date, today });
    expect(r?.days_left).toBe(3);
    expect(r?.remind_now).toBe(true);
  });
});

describe("Fence Cases (data/synthetic/cases/fence.json)", () => {
  it.each(fenceCases.cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    const r = checkFence(c.text);
    if (c.expect === "emergency") {
      expect(r.emergency, c.why).toBe(true);
    } else if (c.expect === "med_change") {
      expect(r.medChange, c.why).toBe(true);
      expect(r.emergency, c.why).toBe(false);
    } else {
      expect(r.triggered, `${c.why}: ${JSON.stringify(r.matches)}`).toBe(false);
    }
  });
});
