import { describe, expect, it } from "vitest";
import { checkFence, FENCE_COPY } from "./index";

const emergency: string[] = [
  "Tengo un dolor de pecho desde anoche",
  "Me duele el pecho cuando subo la cuesta",
  "Siento una presión en el pecho",
  "No puedo respirar bien",
  "Me falta el aire cuando me acuesto",
  "Ay, me ahogo",
  "Ya me quiero morir, mija",
  "A veces pienso en quitarme la vida",
  "Ayer me desmayé en la cocina",
  "Mami tuvo un desmayo en la iglesia",
  "Se le puso la cara torcida y habla enredao",
  "Le dio una convulsión",
  "My mom has chest pain and can't breathe",
];

const medChange: string[] = [
  "Voy a dejar la pastilla de la presión",
  "Esa pastilla no me la voy a tomar más",
  "¿Puedo tomarme dos hoy para ponerme al día?",
  "Ya no me la tomo porque me cae mal",
  "Quiero dejar de tomar la metformina",
  "Me la brinco los domingos",
  "¿Puedo saltarme la pastilla de la noche?",
  "El doctor dijo que iba a subir la dosis",
  "Quiero bajar la dosis de amlodipino",
  "¿Puedo cambiar la medicina por una natural?",
  "Voy a tomarme la mitad",
  "Puedo dejarla si me siento bien?",
  "Should she stop taking the metformin?",
  "Can I double the dose tomorrow?",
];

const clean: string[] = [
  "Hoy me tomé la pastilla de la mañana con el café",
  "La cita de cardiología es el martes",
  "No tengo dolor de pecho, gracias a Dios",
  "Marisol me llamó desde Orlando",
  "Necesito recoger la receta en la farmacia",
  "Voy a tomar más agua como dijo el médico",
  "Mañana salto temprano para el pueblo",
];

describe("Fence: emergency", () => {
  it.each(emergency)("flags %s", (text) => {
    const r = checkFence(text);
    expect(r.emergency).toBe(true);
    expect(r.triggered).toBe(true);
    expect(r.copy[0]).toBe(FENCE_COPY.emergency);
    expect(r.copy).toContain(FENCE_COPY.medChange);
  });
});

describe("Fence: med_change", () => {
  it.each(medChange)("flags %s", (text) => {
    const r = checkFence(text);
    expect(r.medChange).toBe(true);
    expect(r.emergency).toBe(false);
    expect(r.copy).toEqual([FENCE_COPY.medChange]);
  });
});

describe("Fence: clean text", () => {
  it.each(clean)("passes %s", (text) => {
    const r = checkFence(text);
    expect(r.triggered).toBe(false);
    expect(r.copy).toEqual([]);
  });
});

describe("Fence: copy is fixed", () => {
  it("uses the exact strings from ui/AGENTS.md", () => {
    expect(FENCE_COPY.medChange).toBe(
      "Quida no da diagnósticos ni cambia medicamentos. Eso lo decide su médico.",
    );
    expect(FENCE_COPY.emergency).toBe("Si es una emergencia, llame al 911.");
  });

  it("reports both classes when both appear", () => {
    const r = checkFence("Me duele el pecho y voy a dejar la pastilla");
    expect(r.matches.map((m) => m.class).sort()).toEqual(["emergency", "med_change"]);
  });
});
