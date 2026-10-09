import { describe, expect, it } from "vitest";
import type { QuidaEvent } from "@/lib/store/types";
import {
  activeNotices,
  cardKey,
  contrastRatio,
  greetingFor,
  inkOn,
  latestWeekcard,
  medSlots,
  speechText,
} from "./logic";

let n = 0;
function ev(kind: QuidaEvent["kind"], status: QuidaEvent["status"], payload: Record<string, unknown>): QuidaEvent {
  n += 1;
  const t = new Date(2026, 9, 9, 8, n).toISOString();
  return { id: `e${n}`, householdId: "demo-carmen", kind, status, payload, source: "caregiver", confidence: null, createdAt: t, updatedAt: t };
}

describe("greetingFor", () => {
  it("follows the time of day", () => {
    expect(greetingFor(5)).toBe("Buenos días");
    expect(greetingFor(11)).toBe("Buenos días");
    expect(greetingFor(12)).toBe("Buenas tardes");
    expect(greetingFor(18)).toBe("Buenas tardes");
    expect(greetingFor(19)).toBe("Buenas noches");
    expect(greetingFor(2)).toBe("Buenas noches");
  });
});

describe("latestWeekcard", () => {
  const payload = {
    title: "Su semana",
    items: [{ day: "Martes", time: "10:00", text: "Cita con la cardióloga", icon: "🩺" }],
    questionsForDoctor: ["¿Cuándo es el próximo análisis?"],
  };

  it("ignores drafts and picks the newest confirmed card", () => {
    const old = ev("weekcard", "CONFIRMADO", { ...payload, title: "Vieja" });
    const draft = ev("weekcard", "BORRADOR", payload);
    const fresh = ev("weekcard", "CONFIRMADO", payload);
    expect(latestWeekcard([old, draft])?.card.title).toBe("Vieja");
    expect(latestWeekcard([old, draft, fresh])?.event.id).toBe(fresh.id);
    expect(latestWeekcard([draft])).toBeNull();
    expect(latestWeekcard([])).toBeNull();
  });

  it("drops a bad theme but keeps the card", () => {
    const e = ev("weekcard", "CONFIRMADO", { ...payload, theme: { primary: "red", accent: 3 } });
    const got = latestWeekcard([e]);
    expect(got?.card.theme).toBeUndefined();
    expect(got?.card.items).toHaveLength(1);
  });

  it("never renders medication change advice", () => {
    const e = ev("weekcard", "CONFIRMADO", {
      ...payload,
      items: [...payload.items, { day: "Lunes", text: "Puede dejar de tomar la metformina" }],
      questionsForDoctor: ["¿Puedo subir la dosis?", "¿Cuándo es el análisis?"],
    });
    const got = latestWeekcard([e]);
    expect(got?.removed).toBe(true);
    expect(got?.card.items).toHaveLength(1);
    expect(got?.card.questionsForDoctor).toEqual(["¿Cuándo es el análisis?"]);
  });

  it("changes key when the same card is edited", () => {
    const e = ev("weekcard", "CONFIRMADO", payload);
    expect(cardKey(e)).not.toBe(cardKey({ ...e, updatedAt: "2026-10-09T12:00:00.000Z" }));
  });

  it("builds text to read aloud", () => {
    const got = latestWeekcard([ev("weekcard", "CONFIRMADO", payload)]);
    const text = speechText(got!.card);
    expect(text).toContain("Martes, 10:00. Cita con la cardióloga.");
    expect(text).toContain("Para preguntarle al doctor.");
  });
});

describe("theme contrast", () => {
  it("accepts strong colors and rejects mid tones", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(inkOn("#0b4f42")).toBe("#ffffff");
    expect(inkOn("#fbf7f0")).toBe("#1b1a17");
    expect(inkOn("#808080")).toBeNull();
  });
});

describe("medSlots", () => {
  it("fills slots from confirmed schedules only, accents optional", () => {
    const a = ev("med_schedule", "CONFIRMADO", { drug: "metformina", dose: "500 mg", slots: ["mañana", "noche"] });
    const b = ev("med_schedule", "CONFIRMADO", { drug: "amlodipino", slots: ["manana"] });
    const c = ev("med_schedule", "POR_CONFIRMAR", { drug: "otra", slots: ["tarde"] });
    const slots = medSlots([a, b, c]);
    expect(slots.mañana.map((m) => m.drug)).toEqual(["metformina", "amlodipino"]);
    expect(slots.noche).toHaveLength(1);
    expect(slots.tarde).toHaveLength(0);
    expect(slots.mediodía).toHaveLength(0);
  });
});

describe("activeNotices", () => {
  it("shows the newest fence and nudge until dismissed", () => {
    const f1 = ev("fence", "POR_CONFIRMAR", { emergency: false });
    const f2 = ev("fence", "POR_CONFIRMAR", { emergency: true });
    const nu = ev("nudge", "BORRADOR", {});
    expect(activeNotices([f1, f2, nu], new Set())).toEqual([
      { type: "fence", id: f2.id, emergency: true },
      { type: "nudge", id: nu.id },
    ]);
    expect(activeNotices([f1, f2, nu], new Set([f2.id]))).toEqual([{ type: "nudge", id: nu.id }]);
    expect(activeNotices([], new Set())).toEqual([]);
  });
});
