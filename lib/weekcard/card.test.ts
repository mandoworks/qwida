import { describe, expect, it } from "vitest";
import { buildFixtureCard, confirmedFacts, dosesPerDay } from "./fixture";
import { cleanCard, normalizeCard, stripMedAdvice } from "./safety";
import { CARD_THEMES, WeekCard, themeById } from "./schema";
import { seedEvents, HOUSEHOLD_ID } from "@/lib/seed";
import type { QuidaEvent } from "@/lib/store/types";

const TODAY = "2026-10-09";

let counter = 0;

/** Small factory so each test says only what it cares about. */
function event(partial: Partial<QuidaEvent> & { kind: QuidaEvent["kind"] }): QuidaEvent {
  counter += 1;
  const createdAt = partial.createdAt ?? `2026-10-0${Math.min(9, counter)}T12:00:00.000Z`;
  return {
    id: partial.id ?? `evt-${counter}`,
    householdId: HOUSEHOLD_ID,
    kind: partial.kind,
    status: partial.status ?? "BORRADOR",
    payload: partial.payload ?? {},
    source: partial.source ?? "caregiver",
    confidence: partial.confidence ?? null,
    createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
  };
}

describe("card schema", () => {
  it("keeps the shape W4 reads", () => {
    const card: WeekCard = {
      title: "Mi tarjeta de la semana",
      theme: { primary: "#0A2E6B", accent: "#17408C" },
      items: [{ day: "jueves 15 de octubre", time: "10:00", text: "Cita de cardiología.", icon: "+" }],
      questionsForDoctor: ["¿Qué día es la cita?"],
    };
    expect(WeekCard.safeParse(card).success).toBe(true);
  });

  it("offers three color presets and no team names", () => {
    expect(CARD_THEMES.map((t) => t.id)).toEqual(["azul", "rojo", "verde"]);
    for (const theme of CARD_THEMES) {
      expect(theme.primary).toMatch(/^#[0-9A-F]{6}$/);
      expect(theme.accent).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(themeById("verde")).toEqual({ primary: "#14532D", accent: "#166534" });
    expect(themeById("nope")).toBeUndefined();
  });
});

describe("stripMedAdvice", () => {
  it("drops any line that reads as a medication change", () => {
    const { card, removed } = cleanCard({
      title: "Mi tarjeta",
      items: [
        { day: "Hoy", text: "Deje de tomar la pastilla de la presión.", icon: "◆" },
        { day: "Hoy", text: "Cita de cardiología." },
      ],
      questionsForDoctor: ["¿Puede subirle la dosis?"],
    });
    expect(card.items).toEqual([{ day: "Hoy", text: "Cita de cardiología." }]);
    expect(card.questionsForDoctor).toEqual([]);
    expect(removed).toEqual(["Deje de tomar la pastilla de la presión.", "¿Puede subirle la dosis?"]);
  });

  it("reports emergency words instead of sending them", () => {
    const { emergency } = cleanCard({
      title: "Mi tarjeta",
      items: [{ day: "Hoy", text: "Me duele el pecho." }],
      questionsForDoctor: [],
    });
    expect(emergency).toBe(true);
  });

  it("keeps what the doctor already confirmed", () => {
    const { card, removed } = stripMedAdvice({
      title: "Mi tarjeta",
      items: [{ day: "Todos los días", text: "Medicamento confirmado: metformina 500 mg (mañana, noche).", icon: "◆" }],
      questionsForDoctor: ["¿Cuál es la dosis de omeprazol?"],
    });
    expect(removed).toEqual([]);
    expect(card.items).toHaveLength(1);
    expect(card.questionsForDoctor).toHaveLength(1);
  });

  it("drops icons outside the allowed set", () => {
    const { card } = cleanCard({
      title: "Mi tarjeta",
      items: [{ day: "Hoy", text: "Cita.", icon: "★" }],
      questionsForDoctor: [],
    });
    expect(card.items[0].icon).toBeUndefined();
  });

  it("caps the card so the patient can read it", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ day: "Día", text: `Línea ${i}` }));
    const questions = Array.from({ length: 6 }, (_, i) => `¿Pregunta ${i}?`);
    const { card } = cleanCard({ title: "Mi tarjeta", items, questionsForDoctor: questions });
    expect(card.items).toHaveLength(7);
    expect(card.questionsForDoctor).toHaveLength(3);
  });

  it("drops empty lines and falls back to the default title", () => {
    const card = normalizeCard({ title: "   ", items: [{ day: " ", text: " " }], questionsForDoctor: [" "] });
    expect(card.title).toBe("Mi tarjeta de la semana");
    expect(card.items).toEqual([]);
    expect(card.questionsForDoctor).toEqual([]);
  });
});

describe("buildFixtureCard", () => {
  const seed = seedEvents() as unknown as QuidaEvent[];

  it("uses only CONFIRMADO events", () => {
    const facts = confirmedFacts(
      [...seed, event({ kind: "appointment", payload: { specialty: "ojos", date: "2026-10-10T10:00:00Z" } })],
      TODAY,
    );
    expect(facts.appointments.map((a) => a.specialty)).not.toContain("ojos");
  });

  it("builds a line per confirmed appointment, medicine and referral", () => {
    const events: QuidaEvent[] = [
      event({ kind: "appointment", status: "CONFIRMADO", payload: { specialty: "cardiología", doctor: "Dra. Isabel Montalvo (ficticia)", place: "Centro Cardiovascular de Utuado (ficticio)", date: "2026-10-10T14:00:00.000Z" } }),
      event({ kind: "med_schedule", status: "CONFIRMADO", payload: { drug: "metformina", dose: "500 mg", slots: ["mañana", "noche"] } }),
      event({ kind: "referido", status: "CONFIRMADO", payload: { specialty: "endocrinología", expires_on: "2026-10-20" } }),
    ];
    const card = buildFixtureCard(events, TODAY);
    expect(card.title).toBe("Mi tarjeta de la semana");
    expect(card.items).toHaveLength(3);
    expect(card.items[0]).toEqual({
      day: "sábado 10 de octubre",
      time: "14:00",
      text: "Cita de cardiología con Dra. Isabel Montalvo en Centro Cardiovascular de Utuado.",
      icon: "+",
    });
    expect(card.items[1].text).toBe("Medicamento confirmado: metformina 500 mg (mañana, noche).");
    expect(card.items[2].day).toBe("Esta semana");
    expect(card.questionsForDoctor.length).toBeGreaterThan(0);
  });

  it("skips appointments outside the week and referrals far from expiry", () => {
    const events: QuidaEvent[] = [
      event({ kind: "appointment", status: "CONFIRMADO", payload: { specialty: "ojos", date: "2026-11-30T14:00:00.000Z" } }),
      event({ kind: "referido", status: "CONFIRMADO", payload: { specialty: "cardio", expires_on: "2027-06-01" } }),
    ];
    expect(buildFixtureCard(events, TODAY).items).toEqual([]);
  });

  it("never writes medication advice, even from confirmed text", () => {
    const events: QuidaEvent[] = [
      event({ kind: "med_schedule", status: "CONFIRMADO", payload: { drug: "metformina", dose: "500 mg", slots: ["mañana"] } }),
    ];
    const card = buildFixtureCard(events, TODAY);
    expect(stripMedAdvice(card).removed).toEqual([]);
  });

  it("carries the questions from the latest visit", () => {
    const events: QuidaEvent[] = [
      event({ kind: "visit", createdAt: "2026-10-01T12:00:00.000Z", payload: { questions_back: ["¿Qué día exacto es la cita?"] } }),
    ];
    expect(buildFixtureCard(events, TODAY).questionsForDoctor).toEqual(["¿Qué día exacto es la cita?"]);
  });
});

describe("dosesPerDay", () => {
  it("reads the label count, then the frequency text", () => {
    expect(dosesPerDay(event({ kind: "med_schedule", payload: { fields: { times_per_day: { value: 2 } } } }))).toBe(2);
    expect(dosesPerDay(event({ kind: "med_schedule", payload: { frequency: "dos veces al día" } }))).toBe(2);
    expect(dosesPerDay(event({ kind: "med_schedule", payload: {} }))).toBeNull();
  });
});
