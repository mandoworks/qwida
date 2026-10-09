import { gateway, generateText, Output, transcribe } from "ai";
import { checkFence, type FenceResult } from "@/lib/fence";
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
- No des consejos médicos ni recomendaciones. Solo extrae.`;

export function hasAiKey(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function transcribeVisit(audio: Uint8Array): Promise<string> {
  const result = await transcribe({
    model: gateway.transcription(TRANSCRIBE_MODEL),
    audio,
    providerOptions: { openai: { language: "es", prompt: TRANSCRIBE_PROMPT } },
  });
  return result.text;
}

export async function extractVisit(transcript: string, today: string): Promise<VisitExtraction> {
  const { output } = await generateText({
    model: gateway(EXTRACT_MODEL),
    system: EXTRACT_SYSTEM,
    prompt: `Fecha de hoy: ${today}\n\nTranscripción:\n${transcript}`,
    output: Output.object({ schema: VisitExtraction }),
  });
  return enforceUncertainty(output);
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

/**
 * Full visit pipeline: transcribe, Fence, extract, save as BORRADOR.
 * Without an AI key it runs on the SIMULADO fixture so the UI still works offline.
 */
export async function processVisit(store: EventStore, input: VisitInput): Promise<VisitResponse> {
  const simulated = !hasAiKey();
  const today = new Date().toISOString().slice(0, 10);

  let transcript: string;
  if (simulated) transcript = FIXTURE_TRANSCRIPT;
  else if (input.transcript) transcript = input.transcript;
  else if (input.audio) transcript = await transcribeVisit(input.audio);
  else throw new Error("audio or transcript required");

  // The Fence runs before any model sees the text.
  const fence = checkFence(transcript);

  const extraction = simulated ? FIXTURE_EXTRACTION : await extractVisit(transcript, today);

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
    children.push({
      householdId,
      kind: "fence",
      source: "system",
      status: "POR_CONFIRMAR",
      confidence: null,
      payload: { ...tag, context: "visit", visitId: visit.id, emergency: v.fence.emergency, matches: v.fence.matches, copy: v.fence.copy },
    });
  }

  const created = [visit];
  for (const e of children) created.push(await store.create(e));
  return created;
}
