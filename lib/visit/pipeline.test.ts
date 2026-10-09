import { describe, expect, it } from "vitest";
import { MockStore } from "@/lib/store/mock";
import { FIXTURE_EXTRACTION } from "./fixture";
import { enforceUncertainty, processVisit } from "./pipeline";

describe("enforceUncertainty", () => {
  it("forces confirmation when a prescription field is missing", () => {
    const out = enforceUncertainty({
      prescriptions: [{ drug: "omeprazol", dose: null, frequency: "en ayunas", needs_confirmation: false, source_quote: "q" }],
      referidos: [{ specialty: null, needs_confirmation: false, source_quote: "q" }],
      next_appointment: null,
      questions_back: [],
    });
    expect(out.prescriptions[0].needs_confirmation).toBe(true);
    expect(out.referidos[0].needs_confirmation).toBe(true);
  });

  it("drops a malformed resolved date instead of trusting it", () => {
    const out = enforceUncertainty({
      prescriptions: [],
      referidos: [],
      next_appointment: { date_text: "en tres meses", resolved_date: "enero", needs_confirmation: false, source_quote: "q" },
      questions_back: [],
    });
    expect(out.next_appointment?.resolved_date).toBeNull();
    expect(out.next_appointment?.needs_confirmation).toBe(true);
  });

  it("keeps a clean, exact date", () => {
    const out = enforceUncertainty({
      prescriptions: [],
      referidos: [],
      next_appointment: { date_text: "el 15 de enero", resolved_date: "2027-01-15", needs_confirmation: false, source_quote: "q" },
      questions_back: [],
    });
    expect(out.next_appointment?.resolved_date).toBe("2027-01-15");
    expect(out.next_appointment?.needs_confirmation).toBe(false);
  });
});

describe("processVisit without a key", () => {
  it("returns the SIMULADO fixture and saves BORRADOR events", async () => {
    const saved = { key: process.env.AI_GATEWAY_API_KEY, oidc: process.env.VERCEL_OIDC_TOKEN };
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    try {
      const store = new MockStore();
      const r = await processVisit(store, { householdId: "h", transcript: "x" });
      expect(r.simulated).toBe(true);
      expect(r.extraction).toEqual(FIXTURE_EXTRACTION);
      expect(r.events.map((e) => e.kind)).toEqual(["visit", "referido", "appointment"]);
      expect(r.events.every((e) => e.status === "BORRADOR")).toBe(true);
      expect(r.events.every((e) => e.payload.synthetic === true && e.payload.simulated === true)).toBe(true);
    } finally {
      if (saved.key !== undefined) process.env.AI_GATEWAY_API_KEY = saved.key;
      if (saved.oidc !== undefined) process.env.VERCEL_OIDC_TOKEN = saved.oidc;
    }
  });
});
