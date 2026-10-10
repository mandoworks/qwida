import { HOUSEHOLD_ID } from "@/lib/seed";
import { notifyCaregiver } from "@/lib/push/send";
import { getStore } from "@/lib/store";
import { processVisit } from "@/lib/visit/pipeline";

export const maxDuration = 60;

/** Vercel caps request bodies near 4.5 MB: about 20 minutes of opus audio. */
const MAX_AUDIO_BYTES = 4_400_000;
const AUDIO_TYPES = /^(audio\/(webm|ogg|mp4|m4a|x-m4a|mpeg|mp3|wav|x-wav|aac)|video\/webm|video\/mp4)/;

/**
 * POST /api/visit, multipart form:
 *   audio        recorded visit (webm/opus, m4a, mp3, wav)
 *   transcript   optional text instead of audio, for testing
 *   householdId  optional, defaults to the demo household
 * Returns VisitResponse. Events are saved as BORRADOR.
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

  let audio: Uint8Array | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "El audio es muy largo. Máximo unos 20 minutos." }, { status: 413 });
    }
    if (file.type && !AUDIO_TYPES.test(file.type)) {
      return Response.json({ error: `Formato de audio no soportado: ${file.type}` }, { status: 415 });
    }
    audio = new Uint8Array(await file.arrayBuffer());
  }

  const text = typeof transcript === "string" && transcript.trim() ? transcript.trim() : undefined;
  if (!audio && !text) {
    return Response.json({ error: "Falta el audio de la visita." }, { status: 400 });
  }

  try {
    const store = await getStore();
    const result = await processVisit(store, { householdId, audio, transcript: text });
    await notifyCaregiver(householdId, result.events);
    return Response.json(result);
  } catch (err) {
    console.error("visit pipeline failed", err);
    return Response.json(
      { error: "No pudimos procesar la grabación. Intente otra vez." },
      { status: 502 },
    );
  }
}
