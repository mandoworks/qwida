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

/** Generic and brand names the family says out loud, plus common generic suffixes. */
const DRUG_NAMES = "(?:insulina|metformina|amlodipino|losartan|omeprazol|atorvastatina|warfarina|coumadin|aspirina|eliquis|xarelto|plavix|clopidogrel|lisinopril|metoprolol|furosemida|lasix|levotiroxina|synthroid|prednisona|januvia|jardiance|ozempic|glipizida|glimepirida|hidroclorotiazida)";
const DRUG_SUFFIX = "(?:[a-z]+(?:pril|sartan|statina|olol|prazol|formina|dipino|farina|gliptina|tiazida|semida|xaban|gatran|glizida|tiroxina|pirina))";
/** "la de la presión", "la del azúcar": how she names a pill by what it treats. */
const MED_BY_USE = "(?:(?:la|el|las|los) (?:pastillas? |medicinas? |medicamentos? )?(?:del|de la|de los|pa la|pa el) (?:presion|azucar|diabetes|colesterol|corazon|tiroides|sangre|nervios))";
const MED = `(?:pastill(?:as?|itas?)|medicinas?|medicamentos?|pildoras?|remedios?|dosis|tabletas?|capsulas?|receta|${DRUG_NAMES}|${DRUG_SUFFIX}|${MED_BY_USE})`;
const PRON = "(?:la|las|lo|los|le|les)";

const RULES: Rule[] = [
  // Emergency: chest pain, breathing, suicide, fainting, stroke, seizure, overdose,
  // falls, low sugar and bleeding.
  { class: "emergency", name: "chest_pain", pattern: /\b(?:dolor\w*(?: \w+){0,2} (?:en el|de|del) pecho|me duele (?:el|mucho el) pecho|me (?:aprieta|apreto) el pecho|(?:presion|apreton) en el pecho|chest pain)\b/ },
  { class: "emergency", name: "breathing", pattern: /\b(?:no puedo respirar|no puede respirar|me falta el aire|le falta el aire|me ahogo|se ahoga|me estoy ahogando|falta de aire|cant breathe|can t breathe|cannot breathe)\b/ },
  { class: "emergency", name: "self_harm", pattern: /\b(?:me quiero morir|quiero morirme|me voy a matar|matarme|quitarme la vida|no quiero vivir|(?:me quiero|quiero) ir a descansar de una vez|ya no aguanto (?:esto|vivir|la vida)|suicid\w*|want to die|kill myself)\b/ },
  { class: "emergency", name: "fainting", pattern: /\b(?:desmay\w*|perdi el conocimiento|perdio el conocimiento|se privo|me privo|fainted|passed out)\b/ },
  { class: "emergency", name: "stroke", pattern: /\b(?:(?:tengo|tiene|se me puso|se le puso) la cara (?:caida|torcida|dormida)|no puedo mover el brazo|no puede mover el brazo|no puedo hablar bien|habla enredao|habla enredado)\b/ },
  { class: "emergency", name: "seizure", pattern: /\b(?:convulsi\w*|seizure)\b/ },
  // Taking all of them is never a dosing question.
  { class: "emergency", name: "overdose_all", pattern: new RegExp(`\\b(?:me (?:tome|trague) (?:todas|todos|todo) (?:las |los |el )?(?:${MED}|pomo|frasco|caja)|me (?:tome|trague) (?:el|la) (?:pomo|frasco|caja) (?:entero|entera|completo|completa)|me empastille|sobredosis|overdose)\\b`) },
  // An elder fall counts even without a named injury; the copy says "si es una emergencia".
  // "se cayó la pastilla" or "se cayó la luz" is an object falling, not a person.
  { class: "emergency", name: "fall", pattern: /\b(?:me cai|me caigo|me volvi a caer|se cayo(?! (?:la|el|las|los|un|una|mi|su)\b)|se volvio a caer|me resbale|me fui de boca|me di un (?:cantazo|cantaso|golpe|jamaquinazo)|i fell|she fell)\b/ },
  { class: "emergency", name: "fall_injury", pattern: /\b(?:no me puedo (?:parar|levantar)|no se puede (?:parar|levantar)|(?:estoy|esta|sigo|sigue) en el piso|me (?:pegue|di) en la cabeza|se (?:pego|dio) en la cabeza|me rompi (?:la|el)|se rompio (?:la cadera|el brazo|la pierna|la muneca))\b/ },
  { class: "emergency", name: "hypoglycemia", pattern: /\b(?:azucar (?:(?:esta|me esta|anda|se me puso|se le puso|muy|bien) )*(?:bajit\w*|baja|por el piso|en el piso)|(?:se me|me|se le|le) bajo (?:el|la) azucar|hipoglucemia|hipoglicemia|low (?:blood )?sugar|sudor frio)\b/ },
  { class: "emergency", name: "shaky_sweaty", pattern: /\b(?:tembl\w*\b.*\b(?:sudad\w*|sudando|sudor\w*)|(?:sudad\w*|sudando)\b.*\btembl\w*)\b/ },
  { class: "emergency", name: "bleeding", pattern: /\b(?:sangrando|sangro mucho|no (?:para|deja) de sangrar|sangre en (?:la|el|las|los) (?:orina|excremento|caca|heces|popo|pupu|evacuacion|vomito|saliva)|(?:orino|orina|vomite|vomito|toso|tosi|escupo|escupi|boto|botando|bota|me sale|me salio|le sale|le salio) sangre|(?:heces|caca|evacuacion) negras?|excremento negro|bleeding)\b/ },

  // Medication change: stop, skip, increase, reduce, change.
  { class: "med_change", name: "stop", pattern: new RegExp(`\\b(?:dejar|deje|dejo|dejarme|dejarla|dejarlas|parar|pare|suspender|suspendo|quitar|quitarme|quitarle|eliminar)(?: de tomar| de usar)?(?: (?:la|las|el|los|mi|mis|su|sus|esa|esas|ese|esos))? ${MED}\\b`) },
  // Took extra by mistake: a doctor question. With symptoms it becomes an emergency (see checkFence).
  { class: "med_change", name: "overdose", pattern: new RegExp(`\\b(?:me (?:${PRON} )?tome (?:(?:dos|tres|doble|el doble)(?: veces)?(?: ${MED}| dosis)|${PRON} dos veces|de mas|demas|una de mas|mas de la cuenta)|me ${PRON} tome (?:dos veces|doble|otra vez|de nuevo)|me tome (?:la|las|el|mi|mis) ${MED} (?:dos veces|otra vez|de nuevo)|(?:se me fue la mano|me pase) con (?:la|las|el|los|mis) ${MED}|took (?:two|too many|an extra))\\b`) },
  { class: "med_change", name: "stop_pronoun", pattern: new RegExp(`\\b(?:no me ${PRON} (?:voy a|quiero) tomar|no ${PRON} (?:voy a|quiero) tomar|no voy a tomar(?:me)?${PRON}?|ya no me ${PRON} tomo|ya no ${PRON} tomo|ya no (?:me )?tomo|no me ${PRON} (?:di|doy|he dado)|(?:ya )?no (?:me )?(?:quiero|voy a) tomar(?:me)?(?: (?:la|las|el|los|mi|mis))? ${MED}|no me ${PRON} tomo|dejar de tomar\\w*|dejo de tomar\\w*|puedo dejar(?:la|las|lo|los))\\b`) },
  { class: "med_change", name: "skip", pattern: new RegExp(`\\b(?:(?:saltar(?:me)?|brincar(?:me)?|omitir|no tomar(?:me)?)(?: (?:la|las|el|los|una|un|mi|mis|su|sus))? ${MED}|(?:saltarme|brincarme)(?:la|las)|me ${PRON} (?:brinco|salto)|no me ${PRON} tomo hoy)\\b`) },
  { class: "med_change", name: "double", pattern: new RegExp(`\\b(?:tomar(?:me)?(?:${PRON})? (?:dos|doble|el doble|tres|media|la mitad)|tomar(?:me)? (?:mas|menos) (?:de )?(?:la |las |el |los )?${MED}|(?:doble|doblar|duplicar)(?: (?:la|el))? ${MED}|${MED} doble)\\b`) },
  { class: "med_change", name: "adjust", pattern: new RegExp(`\\b(?:subir|subirle|subo|bajar|bajarle|bajo|aumentar|aumento|reducir|reduzco|cambiar|cambio|ajustar)(?: (?:la|las|el|los|mi|mis|su|sus|esa|ese))? ${MED}\\b`) },
  { class: "med_change", name: "english", pattern: /\b(?:stop taking|skip (?:my|her|his|the) (?:pill|dose|medication|meds)|double (?:the|my|her|his) dose|(?:increase|reduce|lower|raise|change) (?:my|her|his|the) (?:dose|dosage|medication|meds))\b/ },
];

/**
 * A denial right before the symptom ("no tengo dolor de pecho", "no estoy
 * sangrando", "no me caí"). Up to two filler words, never across "pero", "y"
 * or "que", so "no sé pero me duele el pecho" still fires.
 */
const NEGATED = /(?:\b(?:no|nunca) (?:tengo|tiene|he tenido|ha tenido|tuve|tuvo|estoy|esta|hay|veo|vi)|\bsin|\bningun|\bninguna|\bnada de|\bniega)\s+(?:(?!pero\s|y\s|que\s)\w+\s+){0,2}$|\bno\s+$/;
const NEGATABLE = new Set([
  "chest_pain", "fainting", "seizure", "overdose_all", "fall", "fall_injury", "hypoglycemia", "shaky_sweaty", "bleeding", "overdose",
]);

/** Symptoms that turn "me tomé de más" into an emergency. */
const OVERDOSE_SYMPTOMS = /\b(?:marea\w*|me siento (?:mal|rara|raro|malita)|no me siento bien|confundid[ao]|vomit\w*|nauseas?|sonolient[ao]|somnolient[ao]|tembl\w*|sudad[ao]|el corazon (?:me late|acelerado|brincando)|palpitaciones)\b/;

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
      if (NEGATABLE.has(rule.name) && NEGATED.test(before)) continue;
      matches.push({ class: rule.class, rule: rule.name, phrase: m[0] });
    }
  }
  const overdose = matches.find((m) => m.rule === "overdose");
  const symptom = overdose && norm.match(OVERDOSE_SYMPTOMS);
  if (symptom) matches.push({ class: "emergency", rule: "overdose_symptoms", phrase: symptom[0] });
  const emergency = matches.some((m) => m.class === "emergency");
  const medChange = matches.some((m) => m.class === "med_change");
  const copy: string[] = [];
  if (emergency) copy.push(FENCE_COPY.emergency);
  if (medChange || emergency) copy.push(FENCE_COPY.medChange);
  return { triggered: emergency || medChange, emergency, medChange, matches, copy };
}
