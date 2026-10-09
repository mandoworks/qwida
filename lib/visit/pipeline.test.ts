import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FENCE_COPY } from "@/lib/fence";
import { MockStore } from "@/lib/store/mock";
import { FIXTURE_EXTRACTION } from "./fixture";
import { EMPTY_EXTRACTION, enforceUncertainty, processVisit } from "./pipeline";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(async () => ({ output: FIXTURE_EXTRACTION })),
  transcribe: vi.fn(async () => ({ text: "no debe llamarse" })),
}));

/** Runs a test with the AI key set or removed, then restores the environment. */
function withKey(value: string | undefined) {
  const saved = { key: process.env.AI_GATEWAY_API_KEY, oidc: process.env.VERCEL_OIDC_TOKEN };
  beforeEach(() => {
    delete process.env.VERCEL_OIDC_TOKEN;
    if (value === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = value;
    vi.mocked(generateText).mockClear();
  });
  afterEach(() => {
    if (saved.key === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = saved.key;
    if (saved.oidc !== undefined) process.env.VERCEL_OIDC_TOKEN = saved.oidc;
  });
}

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

describe("processVisit on an emergency", () => {
  const transcript = "Doctor, me caí y no me puedo parar, y tengo un dolor fuerte en el pecho.";

  describe("with a key", () => {
    withKey("test-key");

    it("never calls the extraction model and saves only the fence event", async () => {
      const store = new MockStore();
      const r = await processVisit(store, { householdId: "h", transcript });
      expect(generateText).not.toHaveBeenCalled();
      expect(r.fence.emergency).toBe(true);
      expect(r.fence.copy[0]).toBe(FENCE_COPY.emergency);
      expect(r.extraction).toEqual(EMPTY_EXTRACTION);
      expect(r.events).toHaveLength(1);
      expect(r.events[0]).toMatchObject({ kind: "fence", source: "system", status: "POR_CONFIRMAR" });
      expect(r.events[0].payload).toMatchObject({ context: "visit", emergency: true, transcript });
      expect(await store.list("h")).toHaveLength(1);
    });

    it("still extracts a calm visit, after the Fence", async () => {
      const store = new MockStore();
      const r = await processVisit(store, { householdId: "h", transcript: "Vuelva en tres meses." });
      expect(generateText).toHaveBeenCalledTimes(1);
      expect(r.fence.triggered).toBe(false);
      expect(r.events.every((e) => e.status === "BORRADOR")).toBe(true);
    });

    it("extracts a med change visit but routes the fence event as POR_CONFIRMAR", async () => {
      const store = new MockStore();
      const r = await processVisit(store, { householdId: "h", transcript: "¿Puedo dejar el losartán?" });
      expect(generateText).toHaveBeenCalledTimes(1);
      expect(r.fence.emergency).toBe(false);
      const fence = r.events.find((e) => e.kind === "fence");
      expect(fence).toMatchObject({ source: "system", status: "POR_CONFIRMAR" });
    });
  });

  describe("without a key", () => {
    withKey(undefined);

    it("fences a typed transcript instead of the fixture", async () => {
      const store = new MockStore();
      const r = await processVisit(store, { householdId: "h", transcript });
      expect(r.simulated).toBe(true);
      expect(r.events.map((e) => e.kind)).toEqual(["fence"]);
      expect(r.extraction).toEqual(EMPTY_EXTRACTION);
    });
  });
});
