import { generateText, Output, transcribe } from "ai";
import { firstThatWorks, hasOpenAIKey, textModels, transcriptionModels } from "@/lib/ai/providers";
import { checkFence, type FenceResult } from "@/lib/fence";
import { fenceEvent } from "@/lib/fence/event";
import type { EventStore, NewEvent, QuidaEvent } from "@/lib/store/types";
import { FIXTURE_EXTRACTION, FIXTURE_TRANSCRIPT } from "./fixture";
import { VisitExtraction, type VisitResponse } from "./schema";

/** Vercel AI Gateway model strings. Swap here, nowhere else. */
export const TRANSCRIBE_MODEL = "openai/gpt-4o-transcribe";
export const EXTRACT_MODEL = "anthropic/claude-sonnet-5.5";

/** Vocabulary hint so Puerto Rican Spanish and drug names transcribe correctly. */
const TRANSCRIBE_PROMPT =
  "Visita médica en Puerto Rico, español puertorriqueño. Doña Carmen, Marisol. " +
  "Metformina, amlodipino, atorvastatina, omeprazol, losartán, miligramos, referido, " +
  "cardiología, endocrinología, plan médico, Plan Vital, Adjuntas.";

const EXTRACT_SYSTEM = `Extraes datos de la transcripción de una visita médica para que una familia los revise.
Reglas:
- Solo lo que el médico dijo de forma explícita. Nunca inventes, completes ni corrijas dosis, nombres o fechas.
- Si un dato no se dijo claramente, déjalo en null, marca needs_confirmation en true y añade una pregunta en questions_back.
- source_quote debe ser una cita literal de la transcripción.
- resolved_date solo si se dijo una fecha de calendario exacta; "en tres meses" deja resolved_date en null.
- Medicamentos que la paciente ya toma y no cambiaron no son recetas nuevas.
- labs: cada laboratorio o estudio que el médico ordenó (sangre, orina, placa, sonograma). fasting en true solo si dijo "en ayunas" para ese laboratorio.
- doctor_notes: cualquier otra indicación del médico que no sea receta, referido, laboratorio ni cita (dieta, ejercicio, señales de alarma, qué traer). source_quote son sus palabras exactas; topic son dos o tres palabras. Nunca la reescribas ni añadas nada.
- No des consejos médicos ni recomendaciones. Solo extrae.`;

export function hasAiKey(): boolean {
  // On Vercel the AI Gateway authenticates through OIDC per request, so no env var is visible here.
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) || hasOpenAIKey();
}

export async function transcribeVisit(audio: Uint8Array): Promise<string> {
  const { value } = await firstThatWorks("visit transcription", transcriptionModels(TRANSCRIBE_MODEL), (model) =>
    transcribe({
      model,
      audio,
      providerOptions: { openai: { language: "es", prompt: TRANSCRIBE_PROMPT } },
    }),
  );
  return value.text;
}

export async function extractVisit(transcript: string, today: string): Promise<VisitExtraction> {
  const { value } = await firstThatWorks("visit extraction", textModels(EXTRACT_MODEL), (model) =>
    generateText({
      model,
      system: EXTRACT_SYSTEM,
      prompt: `Fecha de hoy: ${today}\n\nTranscripción:\n${transcript}`,
      output: Output.object({ schema: VisitExtraction }),
    }),
  );
  return enforceUncertainty(value.output);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deterministic backstop on top of the prompt: any missing field forces
 * needs_confirmation, and a malformed date is dropped rather than trusted.
 */
export function enforceUncertainty(x: VisitExtraction): VisitExtraction {
  const appt = x.next_appointment;
  const resolved =
    appt?.resolved_date && ISO_DATE.test(appt.resolved_date) && !isNaN(Date.parse(appt.resolved_date))
      ? appt.resolved_date
      : null;
  return {
    prescriptions: x.prescriptions.map((p) => ({
      ...p,
      needs_confirmation: p.needs_confirmation || !p.drug || !p.dose || !p.frequency,
    })),
    referidos: x.referidos.map((r) => ({
      ...r,
      needs_confirmation: r.needs_confirmation || !r.specialty,
    })),
    labs: x.labs.map((l) => ({
      ...l,
      needs_confirmation: l.needs_confirmation || !l.test || !l.timing_text,
    })),
    // A note is the doctor's own words; one without a quote is not something the doctor said.
    doctor_notes: x.doctor_notes.filter((n) => n.source_quote.trim() !== ""),
    next_appointment: appt
      ? {
          ...appt,
          resolved_date: resolved,
          needs_confirmation: appt.needs_confirmation || !resolved,
        }
      : null,
    questions_back: x.questions_back,
  };
}

type VisitInput = { householdId: string; audio?: Uint8Array; transcript?: string };

/** What an emergency visit returns: nothing was extracted, on purpose. */
export const EMPTY_EXTRACTION: VisitExtraction = {
  prescriptions: [],
  referidos: [],
  labs: [],
  doctor_notes: [],
  next_appointment: null,
  questions_back: [],
};

/**
 * Full visit pipeline: transcribe, Fence, extract, save as BORRADOR.
 * Without an AI key, or when the gateway refuses (403 billing, timeout, any
 * error), it falls back to the SIMULADO fixture so "Grabar mi cita" never
 * breaks; a typed transcript is still fenced as typed.
 */
export async function processVisit(store: EventStore, input: VisitInput): Promise<VisitResponse> {
  let simulated = !hasAiKey();
  const today = new Date().toISOString().slice(0, 10);

  if (!input.audio && !input.transcript) throw new Error("audio or transcript required");
  let transcript: string;
  if (input.transcript) transcript = input.transcript;
  else if (simulated) transcript = FIXTURE_TRANSCRIPT;
  else {
    try {
      transcript = await transcribeVisit(input.audio!);
    } catch (err) {
      console.error("visit transcription failed, using SIMULADO fixture", err);
      simulated = true;
      transcript = FIXTURE_TRANSCRIPT;
    }
  }

  // Speech to text has to run first on audio: the Fence needs words to check.
  // From here on the Fence runs before any other model sees the text.
  const fence = checkFence(transcript);

  if (fence.emergency) {
    // No extraction call on an emergency. Only the fence event is saved, so a
    // person sees it, and the response carries the fixed emergency copy.
    const event = await store.create(fenceEvent(input.householdId, fence, { context: "visit", simulated, transcript }));
    return { simulated, transcript, fence, extraction: EMPTY_EXTRACTION, events: [event] };
  }

  let extraction = FIXTURE_EXTRACTION;
  if (!simulated) {
    try {
      extraction = await extractVisit(transcript, today);
    } catch (err) {
      // The whole visit becomes the labeled fixture, so the cards always match the
      // transcript shown. The Fence result from what was really said is kept.
      console.error("visit extraction failed, using SIMULADO fixture", err);
      simulated = true;
      transcript = FIXTURE_TRANSCRIPT;
    }
  }

  const events = await saveVisit(store, input.householdId, { transcript, fence, extraction, simulated });
  return { simulated, transcript, fence, extraction, events };
}

async function saveVisit(
  store: EventStore,
  householdId: string,
  v: { transcript: string; fence: FenceResult; extraction: VisitExtraction; simulated: boolean },
): Promise<QuidaEvent[]> {
  const base = { householdId, source: "voice" as const, status: "BORRADOR" as const, confidence: null };
  const tag = { synthetic: true, simulated: v.simulated };

  const visit = await store.create({
    ...base,
    kind: "visit",
    payload: {
      ...tag,
      transcript: v.transcript,
      prescriptions: v.extraction.prescriptions,
      questions_back: v.extraction.questions_back,
      fence: v.fence.triggered ? v.fence : null,
    },
  });

  const children: NewEvent[] = [
    ...v.extraction.referidos.map(
      (r): NewEvent => ({ ...base, kind: "referido", payload: { ...tag, ...r, visitId: visit.id } }),
    ),
    ...v.extraction.labs.map(
      (l): NewEvent => ({ ...base, kind: "lab", payload: { ...tag, ...l, visitId: visit.id } }),
    ),
    ...v.extraction.doctor_notes.map(
      (n): NewEvent => ({ ...base, kind: "doctor_note", payload: { ...tag, ...n, visitId: visit.id } }),
    ),
    ...(v.extraction.next_appointment
      ? [
          {
            ...base,
            kind: "appointment",
            payload: { ...tag, ...v.extraction.next_appointment, visitId: visit.id },
          } satisfies NewEvent,
        ]
      : []),
  ];
  if (v.fence.triggered) {
    // Routes the tripwire to the caregiver. A person must look at it.
    children.push(fenceEvent(householdId, v.fence, { context: "visit", simulated: v.simulated, visitId: visit.id }));
  }

  const created = [visit];
  for (const e of children) created.push(await store.create(e));
  return created;
}
