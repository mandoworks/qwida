import { describe, expect, it } from "vitest";
import { FENCE_COPY } from "@/lib/fence/copy";
import type { QuidaEvent } from "@/lib/store/types";
import { itemsForEvent, itemsForEvents } from "./items";

const event = (over: Partial<QuidaEvent> & { kind: QuidaEvent["kind"] }): QuidaEvent => ({
  id: "e1",
  householdId: "h",
  status: "BORRADOR",
  payload: {},
  source: "voice",
  confidence: null,
  createdAt: "2026-10-09T12:00:00.000Z",
  updatedAt: "2026-10-09T12:00:00.000Z",
  ...over,
});

describe("one alert per thing", () => {
  it("splits a visit into one alert per medicine, the referred and the follow up", () => {
    const items = itemsForEvents([
      event({ id: "v1", kind: "visit", payload: { prescriptions: [{ drug: "losartán", dose: "50 mg" }] } }),
      event({ id: "r1", kind: "referido", payload: { specialty: "cardiología" }, createdAt: "2026-10-09T12:00:01.000Z" }),
      event({
        id: "a1",
        kind: "appointment",
        payload: { date_text: "en tres semanas" },
        createdAt: "2026-10-09T12:00:02.000Z",
      }),
      event({
        id: "v1",
        kind: "visit",
        payload: {
          prescriptions: [
            { drug: "losartán", dose: "50 mg" },
            { drug: "omeprazol", dose: null, needs_confirmation: true },
          ],
          questions_back: ["¿Qué dosis de omeprazol le recetó el médico?"],
        },
        createdAt: "2026-10-09T12:00:00.000Z",
      }),
    ]);

    expect(items.map((i) => i.title)).toEqual([
      "Medicina nueva",
      "Medicina nueva, falta un dato",
      "Una pregunta para usted",
      "Hay un referido",
      "Hablan de otra cita",
    ]);
  });

  it("uses the fixed Fence copy, never a paraphrase", () => {
    const [item] = itemsForEvent(
      event({ kind: "fence", source: "system", payload: { emergency: true, copy: [FENCE_COPY.emergency] } }),
    );
    expect(item.body).toBe(FENCE_COPY.emergency);
  });

  it("reads a photo referred from its nested fields and shows the 90 day date", () => {
    const [item] = itemsForEvent(
      event({
        kind: "referido",
        source: "photo",
        payload: { expires_on: "2027-01-07", fields: { specialty: { value: "cardiología" } } },
      }),
    );
    expect(item.body).toContain("cardiología");
    expect(item.body).toContain("2027-01-07");
  });

  it("says the handwritten note is not trustworthy", () => {
    const [item] = itemsForEvent(event({ kind: "rx_handwritten", source: "photo" }));
    expect(item.title).toBe("Letra de médico, no confiable");
  });

  it("stays quiet about state the caregiver does not act on", () => {
    expect(itemsForEvent(event({ kind: "weekcard", source: "caregiver", status: "CONFIRMADO" }))).toEqual([]);
    expect(itemsForEvent(event({ kind: "med_schedule", source: "caregiver", status: "CONFIRMADO" }))).toEqual([]);
    expect(itemsForEvent(event({ kind: "nudge", source: "system" }))).toEqual([]);
    expect(itemsForEvent(event({ kind: "appointment", payload: { date: null } }))).toEqual([]);
  });

  it("gives every alert a stable tag and the caregiver review screen", () => {
    const items = itemsForEvents([event({ id: "n1", kind: "visit", payload: { prescriptions: [{ drug: "a" }] } })]);
    expect(items[0].tag).toBe("n1:rx:0");
    expect(items[0].url).toBe("/familia/revisar");
    expect(itemsForEvents([event({ id: "n1", kind: "visit", payload: { prescriptions: [{ drug: "a" }] } })])).toEqual(
      items,
    );
  });
});
