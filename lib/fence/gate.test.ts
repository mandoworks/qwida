import { beforeAll, describe, expect, it } from "vitest";
import { gateCreate, gatePatch } from "./gate";

const NOW = new Date("2026-10-09T15:00:00.000Z");

describe("gateCreate", () => {
  it("passes drafts through and strips client written confirmation keys", () => {
    const r = gateCreate(
      { kind: "visit", source: "voice", status: "BORRADOR", payload: { a: 1, confirmedBy: "caregiver", confirmedAt: "x" } },
      undefined,
      NOW,
    );
    expect(r).toEqual({ ok: true, payload: { a: 1 } });
  });

  it("refuses CONFIRMADO without a person", () => {
    const r = gateCreate({ kind: "weekcard", source: "caregiver", status: "CONFIRMADO", payload: {} }, undefined, NOW);
    expect(r.ok).toBe(false);
  });

  it("refuses model output kinds arriving as CONFIRMADO, even with a person named", () => {
    for (const kind of ["visit", "referido", "appointment", "rx_label", "fence", "voice_note"] as const) {
      expect(gateCreate({ kind, source: "voice", status: "CONFIRMADO", payload: {} }, "caregiver", NOW).ok).toBe(false);
    }
  });

  it("refuses a system source as CONFIRMADO", () => {
    expect(gateCreate({ kind: "weekcard", source: "system", status: "CONFIRMADO", payload: {} }, "caregiver", NOW).ok).toBe(false);
  });

  it("accepts the caregiver's week card and stamps who and when", () => {
    const r = gateCreate({ kind: "weekcard", source: "caregiver", status: "CONFIRMADO", payload: { a: 1 } }, "caregiver", NOW);
    expect(r).toEqual({
      ok: true,
      payload: { a: 1, confirmedBy: "caregiver", confirmedAt: NOW.toISOString(), confirmedName: null, confirmedDevice: null },
    });
  });

  it("refuses a week card the patient claims to approve", () => {
    expect(gateCreate({ kind: "weekcard", source: "caregiver", status: "CONFIRMADO", payload: {} }, "patient", NOW).ok).toBe(false);
  });

  it("accepts a med schedule only when it comes from a confirmed photo", () => {
    const base = { kind: "med_schedule" as const, source: "photo" as const, status: "CONFIRMADO" as const };
    expect(gateCreate({ ...base, payload: {} }, "patient", NOW).ok).toBe(false);
    expect(gateCreate({ ...base, payload: { fromEventId: "evt_1" } }, "patient", NOW).ok).toBe(true);
  });

  it("accepts the caregiver's one tap nudge", () => {
    expect(gateCreate({ kind: "nudge", source: "caregiver", status: "CONFIRMADO", payload: {} }, "caregiver", NOW).ok).toBe(true);
  });
});

describe("gatePatch", () => {
  it("lets payload edits and non confirming status changes through", () => {
    expect(gatePatch({ payload: { a: 1 } }, undefined, NOW)).toEqual({ ok: true, payload: { a: 1 } });
    expect(gatePatch({ status: "POR_CONFIRMAR" }, undefined, NOW)).toEqual({ ok: true, payload: undefined });
  });

  it("refuses CONFIRMADO without a person", () => {
    expect(gatePatch({ status: "CONFIRMADO" }, undefined, NOW).ok).toBe(false);
  });

  it("records who confirmed and when, over any client value", () => {
    const r = gatePatch({ status: "CONFIRMADO", payload: { confirmedBy: "model", x: 2 } }, "patient", NOW);
    expect(r).toEqual({
      ok: true,
      payload: { x: 2, confirmedBy: "patient", confirmedAt: NOW.toISOString(), confirmedName: null, confirmedDevice: null },
    });
  });

  it("stamps the person's name and device, and drops any trail or name a client sends", () => {
    const forged = { confirmedName: "Otra persona", confirmedDevice: "x", history: [], x: 2 };
    const r = gatePatch({ status: "CONFIRMADO", payload: forged }, "caregiver", NOW, { name: "Marisol Rivera", device: "iPhone" });
    expect(r).toEqual({
      ok: true,
      payload: { x: 2, confirmedBy: "caregiver", confirmedAt: NOW.toISOString(), confirmedName: "Marisol Rivera", confirmedDevice: "iPhone" },
    });
    expect(gatePatch({ payload: forged }, undefined, NOW)).toEqual({ ok: true, payload: { x: 2 } });
  });
});

describe("/api/events with the gate", () => {
  let route: typeof import("@/app/api/events/route");
  beforeAll(async () => {
    process.env.QUIDA_STORE = "mock";
    route = await import("@/app/api/events/route");
  });

  const json = (method: string, body: unknown) =>
    new Request("http://test/api/events", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("POST refuses a CONFIRMADO visit with 403", async () => {
    const res = await route.POST(json("POST", { householdId: "h1", kind: "visit", source: "voice", status: "CONFIRMADO", payload: {} }));
    expect(res.status).toBe(403);
  });

  it("PATCH confirms only with confirmedBy and records it", async () => {
    const created = await route.POST(json("POST", { householdId: "h1", kind: "referido", source: "voice", payload: { specialty: "cardiología" } }));
    const { event } = await created.json();
    expect(event.status).toBe("BORRADOR");

    const refused = await route.PATCH(json("PATCH", { id: event.id, status: "CONFIRMADO" }));
    expect(refused.status).toBe(403);

    const ok = await route.PATCH(json("PATCH", { id: event.id, status: "CONFIRMADO", confirmedBy: "caregiver" }));
    expect(ok.status).toBe(200);
    const { event: confirmed } = await ok.json();
    expect(confirmed.status).toBe("CONFIRMADO");
    expect(confirmed.payload.confirmedBy).toBe("caregiver");
    expect(typeof confirmed.payload.confirmedAt).toBe("string");
  });

  it("POST of a voice note that trips the Fence saves a fence event too", async () => {
    const res = await route.POST(
      json("POST", { householdId: "h2", kind: "voice_note", source: "voice", status: "POR_CONFIRMAR", payload: { text: "Me caí y no me puedo parar", simulated: true } }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.fence.emergency).toBe(true);
    const list = await (await route.GET(new Request("http://test/api/events?householdId=h2"))).json();
    expect(list.events.map((e: { kind: string }) => e.kind)).toEqual(["voice_note", "fence"]);
  });
});
