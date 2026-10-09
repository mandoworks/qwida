import { FENCE_COPY } from "./copy";

export { FENCE_COPY } from "./copy";

export type FenceClass = "emergency" | "med_change";

export type FenceMatch = { class: FenceClass; rule: string; phrase: string };

export type FenceResult = {
  triggered: boolean;
  emergency: boolean;
  medChange: boolean;
  matches: FenceMatch[];
  /** Fixed copy to show, emergency first. Never generated. */
  copy: string[];
};

type Rule = { class: FenceClass; name: string; pattern: RegExp };

/**
 * Lowercase, strip accents and punctuation, collapse spaces. Patterns below are
 * written against this normalized form, so "Médico" and "medico" match alike.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MED = "(?:pastillas?|medicinas?|medicamentos?|pildoras?|insulina|remedios?|dosis|tabletas?|capsulas?|metformina|amlodipino|receta)";
const PRON = "(?:la|las|lo|los|le|les)";

const RULES: Rule[] = [
  // Emergency: chest pain, breathing, suicide, fainting, stroke and seizure signs.
  { class: "emergency", name: "chest_pain", pattern: /\b(?:dolor (?:en el|de|del) pecho|me duele (?:el|mucho el) pecho|(?:presion|apreton) en el pecho|chest pain)\b/ },
  { class: "emergency", name: "breathing", pattern: /\b(?:no puedo respirar|no puede respirar|me falta el aire|le falta el aire|me ahogo|se ahoga|me estoy ahogando|falta de aire|cant breathe|can t breathe|cannot breathe)\b/ },
  { class: "emergency", name: "self_harm", pattern: /\b(?:me quiero morir|quiero morirme|me voy a matar|matarme|quitarme la vida|no quiero vivir|suicid\w*|want to die|kill myself)\b/ },
  { class: "emergency", name: "fainting", pattern: /\b(?:desmay\w*|perdi el conocimiento|perdio el conocimiento|se privo|me privo|fainted|passed out)\b/ },
  { class: "emergency", name: "stroke", pattern: /\b(?:(?:tengo|tiene|se me puso|se le puso) la cara (?:caida|torcida|dormida)|no puedo mover el brazo|no puede mover el brazo|no puedo hablar bien|habla enredao|habla enredado)\b/ },
  { class: "emergency", name: "seizure", pattern: /\b(?:convulsi\w*|seizure)\b/ },

  // Medication change: stop, skip, increase, reduce, change.
  { class: "med_change", name: "stop", pattern: new RegExp(`\\b(?:dejar|deje|dejo|dejarme|dejarla|dejarlas|parar|pare|suspender|suspendo|quitar|quitarme|quitarle|eliminar)(?: de tomar| de usar)?(?: (?:la|las|el|los|mi|mis|su|sus|esa|esas|ese|esos))? ${MED}\\b`) },
  { class: "med_change", name: "stop_pronoun", pattern: new RegExp(`\\b(?:no me ${PRON} (?:voy a|quiero) tomar|no ${PRON} (?:voy a|quiero) tomar|no voy a tomar(?:me)?${PRON}?|ya no me ${PRON} tomo|ya no ${PRON} tomo|ya no (?:me )?tomo|no me ${PRON} tomo|dejar de tomar\\w*|dejo de tomar\\w*|puedo dejar(?:la|las|lo|los))\\b`) },
  { class: "med_change", name: "skip", pattern: new RegExp(`\\b(?:(?:saltar(?:me)?|brincar(?:me)?|omitir|no tomar(?:me)?)(?: (?:la|las|el|los|una|un|mi|mis|su|sus))? ${MED}|(?:saltarme|brincarme)(?:la|las)|me ${PRON} (?:brinco|salto)|no me ${PRON} tomo hoy)\\b`) },
  { class: "med_change", name: "double", pattern: new RegExp(`\\b(?:tomar(?:me)?(?:${PRON})? (?:dos|doble|el doble|tres|media|la mitad)|tomar(?:me)? (?:mas|menos) (?:de )?(?:la |las |el |los )?${MED}|(?:doble|doblar|duplicar)(?: (?:la|el))? ${MED}|${MED} doble)\\b`) },
  { class: "med_change", name: "adjust", pattern: new RegExp(`\\b(?:subir|subirle|subo|bajar|bajarle|bajo|aumentar|aumento|reducir|reduzco|cambiar|cambio|ajustar)(?: (?:la|las|el|los|mi|mis|su|sus|esa|ese))? ${MED}\\b`) },
  { class: "med_change", name: "english", pattern: /\b(?:stop taking|skip (?:my|her|his|the) (?:pill|dose|medication|meds)|double (?:the|my|her|his) dose|(?:increase|reduce|lower|raise|change) (?:my|her|his|the) (?:dose|dosage|medication|meds))\b/ },
];

/** Symptom words said with a denial right before them ("no tengo dolor de pecho"). */
const NEGATED = /\b(?:no tengo|no tiene|no he tenido|no ha tenido|sin|ningun|nada de|niega)\s+(?:\w+\s+){0,2}$/;

/**
 * Deterministic tripwire. Runs before any model call on any text: visit
 * transcripts, typed or spoken questions. Errs on the side of triggering.
 */
export function checkFence(text: string): FenceResult {
  const norm = normalize(text);
  const matches: FenceMatch[] = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, "g");
    for (const m of norm.matchAll(re)) {
      const before = norm.slice(0, m.index);
      if (rule.class === "emergency" && ["chest_pain", "fainting", "seizure"].includes(rule.name) && NEGATED.test(before)) {
        continue;
      }
      matches.push({ class: rule.class, rule: rule.name, phrase: m[0] });
    }
  }
  const emergency = matches.some((m) => m.class === "emergency");
  const medChange = matches.some((m) => m.class === "med_change");
  const copy: string[] = [];
  if (emergency) copy.push(FENCE_COPY.emergency);
  if (medChange || emergency) copy.push(FENCE_COPY.medChange);
  return { triggered: emergency || medChange, emergency, medChange, matches, copy };
}
