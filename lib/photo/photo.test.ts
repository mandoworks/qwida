import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockStore } from "@/lib/store/mock";
import { capImage, MAX_IMAGE_CHARS } from "@/lib/store/redis";
import type { HeardPrescription } from "@/lib/visit/schema";
import { confirmPhoto } from "./confirm";
import { formatDia, referidoExpiresOn } from "./dates";
import { FIXTURE_HANDWRITTEN, FIXTURE_LABEL } from "./fixture";
import { processPhoto } from "./pipeline";
import { refillCountdown, unitsPerDose } from "./refill";
import { applyTrust, deriveSlots, HANDWRITTEN_BADGE, LABEL_RESCAN_TEXT } from "./trust";

const heard = (drug: string, dose: string | null): HeardPrescription => ({
  drug,
  dose,
  frequency: null,
  needs_confirmation: false,
  source_quote: "q",
});

describe("deriveSlots", () => {
  it("maps counts to the four daily slots", () => {
    expect(deriveSlots("una vez al día", null)).toEqual(["mañana"]);
    expect(deriveSlots("1 tableta diaria", null)).toEqual(["mañana"]);
    expect(deriveSlots("dos veces al día", null)).toEqual(["mañana", "noche"]);
    expect(deriveSlots("cada 8 horas", null)).toEqual(["mañana", "mediodía", "noche"]);
    expect(deriveSlots(null, 3)).toEqual(["mañana", "mediodía", "noche"]);
  });

  it("keeps a single named time of day", () => {
    expect(deriveSlots("una pastilla en la noche", null)).toEqual(["noche"]);
    expect(deriveSlots("una vez al día al acostarse", 1)).toEqual(["noche"]);
  });

  it("asks instead of guessing", () => {
    expect(deriveSlots(null, null)).toBeNull();
    expect(deriveSlots("según indicado", null)).toBeNull();
    expect(deriveSlots("dos veces al día", 1)).toBeNull();
    expect(deriveSlots("once tabletas", null)).toBeNull();
  });
});

describe("referido expiry", () => {
  it("is the issue date plus 90 days, computed in code", () => {
    expect(referidoExpiresOn("2026-10-09")).toBe("2027-01-07");
    expect(formatDia("2027-01-07")).toBe("7 de enero");
  });

  it("refuses a malformed date", () => {
    expect(referidoExpiresOn("2026-02-30")).toBeNull();
    expect(referidoExpiresOn("9 de octubre")).toBeNull();
  });
});

describe("refillCountdown", () => {
  it("counts days left and reminds 7 days before", () => {
    const r = refillCountdown({ quantity: 30, perDay: 1, fillDate: "2026-10-09", today: "2026-10-09" });
    expect(r).toEqual({ days_supply: 30, runs_out_on: "2026-11-08", remind_on: "2026-11-01", days_left: 30, remind_now: false });
  });

  it("flags the reminder from remind_on and never goes negative", () => {
    expect(refillCountdown({ quantity: 30, perDay: 1, fillDate: "2026-10-09", today: "2026-11-02" })).toMatchObject({ days_left: 6, remind_now: true });
    expect(refillCountdown({ quantity: 30, perDay: 2, fillDate: "2026-10-09", today: "2026-12-01" })).toMatchObject({ days_supply: 15, days_left: 0 });
  });

  it("returns null without usable inputs", () => {
    expect(refillCountdown({ quantity: null, perDay: 1, fillDate: "2026-10-09", today: "2026-10-09" })).toBeNull();
    expect(refillCountdown({ quantity: 30, perDay: 1, fillDate: null, today: "2026-10-09" })).toBeNull();
  });

  it("reads units per dose", () => {
    expect(unitsPerDose("1 tableta")).toBe(1);
    expect(unitsPerDose("2 tabletas")).toBe(2);
    expect(unitsPerDose("media tableta")).toBe(0.5);
    expect(unitsPerDose(null)).toBe(1);
  });
});

describe("applyTrust", () => {
  it("never trusts handwriting", () => {
    const t = applyTrust(FIXTURE_HANDWRITTEN);
    expect(t.trusted).toBe(false);
    expect(t.badge).toBe(HANDWRITTEN_BADGE);
    expect(t.status).toBe("POR_CONFIRMAR");
    expect(t.canSchedule).toBe(false);
    expect(Object.values(t.fields!).every((f) => !f.prefill && f.highlight)).toBe(true);
  });

  it("pre-fills confident label fields and highlights the rest", () => {
    const t = applyTrust(FIXTURE_LABEL);
    expect(t.fields!.drug).toMatchObject({ prefill: true, highlight: false });
    expect(t.fields!.prescriber).toMatchObject({ prefill: false, highlight: true });
    expect(t.status).toBe("POR_CONFIRMAR");
  });

  it("drops a malformed date the model returned", () => {
    const bad = structuredClone(FIXTURE_LABEL);
    bad.prescription!.date = { value: "10/09/2026", confidence: 0.99, source_text: "10/09/2026" };
    expect(applyTrust(bad).fields!.date).toMatchObject({ value: null, confidence: 0, highlight: true });
  });

  it("cross checks the label against the visit", () => {
    expect(applyTrust(FIXTURE_LABEL, [heard("Losartan", "50 miligramos")]).fields!.strength.mismatch).toBeUndefined();

    const dose = applyTrust(FIXTURE_LABEL, [heard("losartán", "25 mg")]).fields!;
    expect(dose.strength).toMatchObject({ highlight: true, mismatch: { visit: "25 mg" } });
    expect(dose.strength.value).toBe("50 mg");

    const drug = applyTrust(FIXTURE_LABEL, [heard("atorvastatina", "20 mg")]).fields!;
    expect(drug.drug).toMatchObject({ highlight: true, mismatch: { visit: "atorvastatina" } });
  });
});

describe("photo pipeline without a key (SIMULADO)", () => {
  const saved = { key: process.env.AI_GATEWAY_API_KEY, oidc: process.env.VERCEL_OIDC_TOKEN };
  beforeAll(() => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
  });
  afterAll(() => {
    if (saved.key !== undefined) process.env.AI_GATEWAY_API_KEY = saved.key;
    if (saved.oidc !== undefined) process.env.VERCEL_OIDC_TOKEN = saved.oidc;
  });

  const image = new Uint8Array([1, 2, 3]);
  const input = (hint: string | null) => ({ householdId: "h", image, mediaType: "image/jpeg", hint });
  const confirm = (store: MockStore, eventId: string, values = {}) =>
    confirmPhoto(store, { eventId, householdId: "h", values, confirmedBy: "caregiver" }, "2026-10-09");

  it("handwriting: POR_CONFIRMAR, rescan reminder, and no schedule even on confirm", async () => {
    const store = new MockStore();
    const r = await processPhoto(store, input("rx_handwritten"));
    expect(r.simulated).toBe(true);
    expect(r.badge).toBe(HANDWRITTEN_BADGE);
    expect(r.events.map((e) => [e.kind, e.status])).toEqual([
      ["rx_handwritten", "POR_CONFIRMAR"],
      ["nudge", "BORRADOR"],
    ]);
    expect(r.events[1].payload).toMatchObject({ type: "label_rescan", text: LABEL_RESCAN_TEXT });

    const c = await confirm(store, r.events[0].id);
    expect(c).toMatchObject({ ok: false, status: 409 });
    expect((await store.list("h")).some((e) => e.kind === "med_schedule")).toBe(false);
  });

  it("follows the demo order when no hint is given", async () => {
    const store = new MockStore();
    expect((await processPhoto(store, input(null))).class).toBe("rx_handwritten");
    expect((await processPhoto(store, input(null))).class).toBe("rx_label");
    expect((await processPhoto(store, input(null))).class).toBe("referido");
  });

  it("label: confirm creates a CONFIRMADO schedule with refill countdown", async () => {
    const store = new MockStore();
    const r = await processPhoto(store, input("rx_label"));
    expect(r.events.map((e) => [e.kind, e.status])).toEqual([["rx_label", "POR_CONFIRMAR"]]);
    expect(String(r.events[0].payload.image)).toMatch(/^data:image\/jpeg;base64,/);

    const c = await confirm(store, r.events[0].id);
    if (!c.ok) throw new Error(c.error);
    expect(c.confirmed.status).toBe("CONFIRMADO");
    expect(c.created).toMatchObject({ kind: "med_schedule", status: "CONFIRMADO" });
    expect(c.confirmed.payload.scheduleId).toBe(c.created!.id);
    expect(c.created!.payload).toMatchObject({
      drug: "losartán",
      dose: "50 mg",
      slots: ["mañana"],
      quantity: 30,
      refill: { days_supply: 30, runs_out_on: "2026-11-08", remind_on: "2026-11-01" },
      fromEventId: r.events[0].id,
    });
    expect(await confirm(store, r.events[0].id)).toMatchObject({ ok: false, status: 409 });
  });

  it("label: edited values win, unknown frequency asks", async () => {
    const store = new MockStore();
    const r = await processPhoto(store, input("rx_label"));
    const ask = await confirm(store, r.events[0].id, { frequency: "según indicado", times_per_day: null });
    expect(ask).toMatchObject({ ok: false, status: 422, needsFrequency: true });

    const c = await confirm(store, r.events[0].id, { frequency: "dos veces al día", times_per_day: 2 });
    if (!c.ok) throw new Error(c.error);
    expect(c.created!.payload).toMatchObject({ slots: ["mañana", "noche"], edited: ["frequency", "times_per_day"] });
  });

  it("referido: expires 90 days after issue, confirmed in place with the edited date", async () => {
    const store = new MockStore();
    const r = await processPhoto(store, input("referido"));
    expect(r.expires_on).toBe("2027-01-07");
    expect(r.events[0]).toMatchObject({ kind: "referido", status: "POR_CONFIRMAR" });

    const c = await confirm(store, r.events[0].id, { issue_date: "2026-10-01" });
    if (!c.ok) throw new Error(c.error);
    expect(c.created).toBeNull();
    expect(c.confirmed).toMatchObject({ id: r.events[0].id, kind: "referido", status: "CONFIRMADO" });
    expect(c.confirmed.payload).toMatchObject({ issue_date: "2026-10-01", expires_on: "2026-12-30", specialty: "cardiología" });

    const referidos = (await store.list("h")).filter((e) => e.kind === "referido");
    expect(referidos.map((e) => e.id)).toEqual([r.events[0].id]);
  });
  it("saves the small preview with the event, and returns a photo the store kept out", async () => {
    const store = new MockStore();
    const preview = { bytes: new Uint8Array([9, 9]), mediaType: "image/jpeg" };
    const r = await processPhoto(store, { ...input("rx_label"), preview });
    expect((await store.list("h"))[0].payload.image).toBe("data:image/jpeg;base64,CQk=");
    expect(r.events[0].payload.image).toBe("data:image/jpeg;base64,CQk=");

    // A store that drops large photos (as RedisStore does over 300 KB).
    const capped = new MockStore();
    const create = capped.create.bind(capped);
    capped.create = (e) => create({ ...e, payload: capImage(e.payload) });
    const big = new Uint8Array(MAX_IMAGE_CHARS);
    const r2 = await processPhoto(capped, { ...input("rx_label"), image: big });
    expect((await capped.list("h"))[0].payload).toMatchObject({ image: null, image_omitted: true });
    expect(String(r2.events[0].payload.image)).toMatch(/^data:image\/jpeg;base64,/);
  });
});
