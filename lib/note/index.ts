import { checkFence, type FenceResult } from "@/lib/fence";
import { fenceEvent } from "@/lib/fence/event";
import type { EventStore, QuidaEvent } from "@/lib/store/types";
import { hasAiKey, transcribeVisit } from "@/lib/visit/pipeline";

/**
 * SIMULADO transcripts for the synthetic demo notes in public/demo, picked by
 * file name when there is no key or transcription fails.
 */
export const NOTE_FIXTURES: Record<string, string> = {
  "nota-fence": "¿Puedo dejar de tomarme la pastilla de la presión?",
  "nota-cita": "Mija, la cita con el cardiólogo es el martes a las diez. Llámame pa' que no se me olvide.",
};

/** Any other recording without a key: say so instead of inventing words. */
export const NOTE_UNTRANSCRIBED = "Nota de voz de Mamá";

export function fixtureFor(filename: string | undefined): string {
  const name = (filename ?? "").toLowerCase();
  const key = Object.keys(NOTE_FIXTURES).find((k) => name.includes(k));
  return key ? NOTE_FIXTURES[key] : NOTE_UNTRANSCRIBED;
}

type NoteInput = {
  householdId: string;
  audio?: Uint8Array;
  filename?: string;
  /** Typed text instead of audio, for testing. */
  transcript?: string;
  durationSec?: number;
};

/** Response body of POST /api/note. */
export type NoteResponse = {
  simulated: boolean;
  transcript: string;
  fence: FenceResult;
  /** The voice_note event, then the fence event when the Fence tripped. */
  events: QuidaEvent[];
};

/**
 * Patient voice note: transcribe, Fence, save. Speech to text runs first
 * because the Fence needs words; no other model ever sees the note.
 */
export async function processNote(store: EventStore, input: NoteInput): Promise<NoteResponse> {
  let simulated = !hasAiKey();
  let transcript: string;
  if (input.transcript) transcript = input.transcript;
  else if (simulated || !input.audio) transcript = fixtureFor(input.filename);
  else {
    try {
      transcript = await transcribeVisit(input.audio);
    } catch (err) {
      console.error("note transcription failed, using the SIMULADO fixture", err);
      simulated = true;
      transcript = fixtureFor(input.filename);
    }
  }

  const fence = checkFence(transcript);

  const note = await store.create({
    householdId: input.householdId,
    kind: "voice_note",
    source: "voice",
    status: "POR_CONFIRMAR",
    confidence: null,
    payload: { synthetic: true, simulated, durationSec: input.durationSec ?? null, text: transcript },
  });
  const events = [note];
  if (fence.triggered) {
    events.push(await store.create(fenceEvent(input.householdId, fence, { context: "note", simulated, noteId: note.id, transcript })));
  }
  return { simulated, transcript, fence, events };
}
