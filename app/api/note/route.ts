import { processNote } from "@/lib/note";
import { notifyCaregiver } from "@/lib/push/send";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const maxDuration = 30;

/** A voice note is short; this is about two minutes of opus audio. */
const MAX_AUDIO_BYTES = 1_000_000;
const AUDIO_TYPES = /^(audio\/(webm|ogg|mp4|m4a|x-m4a|mpeg|mp3|wav|x-wav|aac)|video\/webm|video\/mp4)/;

/**
 * POST /api/note, multipart form, from the patient "Hablar" tile:
 *   audio        recorded note (webm/opus, m4a, mp3, wav); the file name picks
 *                the SIMULADO transcript when there is no key
 *   durationSec  optional, seconds recorded
 *   transcript   optional text instead of audio, for testing
 *   householdId  optional, defaults to the demo household
 * Returns NoteResponse: { simulated, transcript, fence, events }.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envíe el audio como multipart/form-data." }, { status: 400 });
  }

  const householdId = String(form.get("householdId") || HOUSEHOLD_ID);
  const transcript = form.get("transcript");
  const file = form.get("audio");
  const duration = Number(form.get("durationSec"));

  let audio: Uint8Array | undefined;
  let filename: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "La nota es muy larga. Máximo unos dos minutos." }, { status: 413 });
    }
    if (file.type && !AUDIO_TYPES.test(file.type)) {
      return Response.json({ error: `Formato de audio no soportado: ${file.type}` }, { status: 415 });
    }
    audio = new Uint8Array(await file.arrayBuffer());
    filename = file.name;
  }

  const text = typeof transcript === "string" && transcript.trim() ? transcript.trim() : undefined;
  if (!audio && !text) {
    return Response.json({ error: "Falta el audio de la nota." }, { status: 400 });
  }

  try {
    const store = await getStore();
    const result = await processNote(store, {
      householdId,
      audio,
      filename,
      transcript: text,
      durationSec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined,
    });
    await notifyCaregiver(householdId, result.events);
    return Response.json(result);
  } catch (err) {
    console.error("note failed", err);
    return Response.json({ error: "No pudimos guardar la nota. Intente otra vez." }, { status: 502 });
  }
}
