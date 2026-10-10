import { processPhoto } from "@/lib/photo/pipeline";
import { notifyCaregiver } from "@/lib/push/send";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const maxDuration = 60;

/** Vercel caps request bodies near 4.5 MB. PhotoCapture shrinks photos well below this. */
const MAX_IMAGE_BYTES = 4_400_000;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|heic|heif|gif)$/;

/**
 * POST /api/photo, multipart form:
 *   image        photo of a prescription, pharmacy label, referido or slip
 *   householdId  optional, defaults to the demo household
 *   hint         optional: rx_handwritten, rx_label, referido or appointment_slip. Picks the SIMULADO fixture.
 *   preview      optional smaller copy of the photo, saved with the event for the other phone
 * Returns PhotoResponse. Events are saved as POR_CONFIRMAR; no schedule is created here.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envíe la foto como multipart/form-data." }, { status: 400 });
  }

  const householdId = String(form.get("householdId") || HOUSEHOLD_ID);
  const hint = typeof form.get("hint") === "string" ? String(form.get("hint")).trim() || null : null;
  const file = form.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Falta la foto." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "La foto es muy grande. Intente con otra." }, { status: 413 });
  }
  const mediaType = file.type || "image/jpeg";
  if (!IMAGE_TYPES.test(mediaType)) {
    return Response.json({ error: `Formato de foto no soportado: ${mediaType}` }, { status: 415 });
  }

  try {
    const store = await getStore();
    const image = new Uint8Array(await file.arrayBuffer());
    const p = form.get("preview");
    const preview =
      p instanceof File && p.size > 0 && IMAGE_TYPES.test(p.type)
        ? { bytes: new Uint8Array(await p.arrayBuffer()), mediaType: p.type }
        : undefined;
    const result = await processPhoto(store, { householdId, image, mediaType, hint, preview });
    await notifyCaregiver(householdId, result.events);
    return Response.json(result);
  } catch (err) {
    console.error("photo pipeline failed", err);
    return Response.json({ error: "No pudimos leer la foto. Intente otra vez." }, { status: 502 });
  }
}
