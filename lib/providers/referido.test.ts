import { describe, expect, it } from "vitest";
import { providers } from "./catalog";
import { readable } from "./format";
import { ASES_RULE, activeReferido, expiryLine, nudgeEvent } from "./referido";
import type { QuidaEvent } from "@/lib/store/types";

const BASE = {
  householdId: "demo-carmen",
  source: "caregiver" as const,
  confidence: 1,
  createdAt: "2026-10-09T10:00:00.000Z",
  updatedAt: "2026-10-09T10:00:00.000Z",
};

function evento(over: Partial<QuidaEvent> & Pick<QuidaEvent, "kind" | "status">): QuidaEvent {
  return { ...BASE, id: "e1", payload: {}, ...over };
}

describe("activeReferido", () => {
  it("takes the latest confirmed referral with a real expiry date", () => {
    const events = [
      evento({ id: "a", kind: "referido", status: "CONFIRMADO", payload: { expires_on: "2026-11-15", specialty: "cardiología" } }),
      evento({ id: "b", kind: "referido", status: "CONFIRMADO", payload: { expires_on: "2027-01-07", specialty: "endocrinología" } }),
    ];
    expect(activeReferido(events)).toEqual({ expiresOn: "2027-01-07", specialty: "endocrinología", eventId: "b" });
  });

  it("ignores drafts, other kinds and broken dates", () => {
    const events = [
      evento({ kind: "referido", status: "BORRADOR", payload: { expires_on: "2027-01-07" } }),
      evento({ kind: "referido", status: "POR_CONFIRMAR", payload: { expires_on: "2027-01-07" } }),
      evento({ kind: "referido", status: "CONFIRMADO", payload: { expires_on: "2027-02-30" } }),
      evento({ kind: "referido", status: "CONFIRMADO", payload: {} }),
      evento({ kind: "appointment", status: "CONFIRMADO", payload: { expires_on: "2027-01-07" } }),
    ];
    expect(activeReferido(events)).toBeNull();
    expect(activeReferido([])).toBeNull();
  });

  it("reports a referral with no specialty instead of failing", () => {
    const events = [evento({ kind: "referido", status: "CONFIRMADO", payload: { expires_on: "2027-01-07", specialty: 7 } })];
    expect(activeReferido(events)?.specialty).toBeNull();
  });
});

describe("expiryLine", () => {
  it("counts in the present until the day passes", () => {
    expect(expiryLine("2027-01-07", "2026-10-09")).toBe("Su referido vence el 7 de enero");
    expect(expiryLine("2027-01-07", "2027-01-07")).toBe("Su referido vence hoy, 7 de enero");
    expect(expiryLine("2027-01-07", "2027-02-01")).toBe("Su referido ya venció el 7 de enero");
  });
});

describe("nudgeEvent", () => {
  const provider = providers[0];

  it("asks for a call about a cita and cites the referral deadline", () => {
    const event = nudgeEvent(provider, "2027-01-07");
    expect(event.kind).toBe("nudge");
    expect(event.status).toBe("CONFIRMADO");
    expect(event.source).toBe("caregiver");
    expect(event.payload.text).toBe(`Llamar a ${readable(provider.name)} para cita antes del 7 de enero`);
    expect(event.payload.doctor_license).toBe(provider.license_number);
    expect(event.payload.expires_on).toBe("2027-01-07");
    expect(String(event.payload.ases_rule)).toBe(ASES_RULE);
  });

  it("keeps a null phone as null instead of inventing one", () => {
    const withoutPhone = providers.find((p) => p.phone === null);
    expect(withoutPhone).toBeDefined();
    expect(nudgeEvent(withoutPhone!, "2027-01-07").payload.doctor_phone).toBeNull();
  });

  it("never tells the patient to take, skip, stop or change a medicine", () => {
    const event = nudgeEvent(provider, "2027-01-07");
    const text = Object.values(event.payload).join(" ").toLowerCase();
    for (const forbidden of ["pastilla", "medicamento", "dosis", "tome", "toma", "omita", "suspenda", "aumente", "reduzca"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
