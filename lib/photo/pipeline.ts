import { gateway, generateText, Output } from "ai";
import { checkFence } from "@/lib/fence";
import type { EventStore, NewEvent, QuidaEvent } from "@/lib/store/types";
import { hasAiKey } from "@/lib/visit/pipeline";
import type { HeardPrescription } from "@/lib/visit/schema";
import { referidoExpiresOn } from "./dates";
import { pickFixture } from "./fixture";
import { PhotoExtraction, type PhotoResponse } from "./schema";
import { applyTrust, LABEL_RESCAN_TEXT } from "./trust";

/** Vision model through the Vercel AI Gateway. Swap here, nowhere else. */
export const PHOTO_MODEL = "anthropic/claude-sonnet-5.5";

const PHOTO_SYSTEM = `Lees fotos de papeles médicos de una familia en Puerto Rico para que una persona los revise.
Reglas:
- Primero clasifica la foto: receta escrita a mano (rx_handwritten), etiqueta impresa de farmacia (rx_label), referido, hoja de cita (appointment_slip) u otra cosa (other).
- Copia solo lo que está escrito. Nunca inventes, completes ni corrijas nombres, dosis, cantidades o fechas.
- Si un dato no se puede leer con claridad, value en null, confidence bajo y source_text '[ilegible]'. Añade una nota en unreadable_lines.
- La letra a mano casi nunca merece confidence alto.
- Fechas como YYYY-MM-DD. En Puerto Rico las recetas suelen escribir día/mes/año; las etiquetas de farmacia, mes/día/año.
- No des consejos médicos ni recomendaciones. Solo lee.`;

export async function extractPhoto(image: Uint8Array, mediaType: string, hint: string | null): Promise<PhotoExtraction> {
  const { output } = await generateText({
    model: gateway(PHOTO_MODEL),
    system: PHOTO_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: hint ? `La persona dice que la foto es: ${hint}.` : "Lea esta foto." },
          { type: "file", mediaType, data: image },
        ],
      },
    ],
    output: Output.object({ schema: PhotoExtraction }),
  });
  return output;
}

/** Every value and every piece of text read, for the Fence. */
function readText(x: PhotoExtraction): string {
  const fields = [...Object.values(x.prescription ?? {}), ...Object.values(x.referido ?? {})];
  return [...fields.flatMap((f) => [String(f.value ?? ""), f.source_text]), ...x.unreadable_lines].join("\n");
}

function meanConfidence(values: { confidence: number }[]): number | null {
  if (!values.length) return null;
  return Math.min(1, Math.max(0, values.reduce((s, v) => s + v.confidence, 0) / values.length));
}

/** Prescriptions heard in the most recent visit recording, for the label cross check. */
function latestVisitPrescriptions(events: QuidaEvent[]): HeardPrescription[] | undefined {
  const visit = events.filter((e) => e.kind === "visit").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const p = visit?.payload.prescriptions;
  return Array.isArray(p) ? (p as HeardPrescription[]) : undefined;
}

type PhotoInput = {
  householdId: string;
  image: Uint8Array;
  mediaType: string;
  /** Smaller copy saved with the event so the other phone can see it. Defaults to the full image. */
  preview?: { bytes: Uint8Array; mediaType: string };
  hint: string | null;
};

/**
 * Full photo pipeline: read (model or SIMULADO fixture), deterministic trust
 * rules, Fence, save as POR_CONFIRMAR. Never creates a med schedule: that only
 * happens in confirmPhoto after a person taps Confirmar.
 */
export async function processPhoto(store: EventStore, input: PhotoInput): Promise<PhotoResponse> {
  const existing = await store.list(input.householdId);

  let simulated = !hasAiKey();
  let extraction: PhotoExtraction | null = null;
  if (!simulated) {
    try {
      extraction = await extractPhoto(input.image, input.mediaType, input.hint);
    } catch (err) {
      console.error("photo extraction failed, using SIMULADO fixture", err);
      simulated = true;
    }
  }
  if (!extraction) extraction = pickFixture(input.hint, new Set(existing.map((e) => e.kind)));

  const fence = checkFence(readText(extraction));
  const trust = applyTrust(extraction, latestVisitPrescriptions(existing));
  const issue = trust.fields?.issue_date?.value;
  const expires_on = extraction.class === "referido" && typeof issue === "string" ? referidoExpiresOn(issue) : null;

  const tag = { synthetic: true, simulated };
  const shown = input.preview ?? { bytes: input.image, mediaType: input.mediaType };
  const image = `data:${shown.mediaType};base64,${Buffer.from(shown.bytes).toString("base64")}`;
  const toSave: NewEvent[] = [];

  if (trust.fields && (extraction.class === "rx_handwritten" || extraction.class === "rx_label" || extraction.class === "referido")) {
    toSave.push({
      householdId: input.householdId,
      kind: extraction.class,
      source: "photo",
      status: trust.status,
      confidence: meanConfidence(Object.values(trust.fields)),
      payload: {
        ...tag,
        class: extraction.class,
        trusted: trust.trusted,
        badge: trust.badge,
        fields: trust.fields,
        unreadable_lines: extraction.unreadable_lines,
        ...(expires_on ? { expires_on } : {}),
        image,
      },
    });
  }
  if (extraction.class === "rx_handwritten") {
    // Fixed copy: the label, not the handwriting, becomes the schedule.
    toSave.push({
      householdId: input.householdId,
      kind: "nudge",
      source: "system",
      status: "BORRADOR",
      confidence: null,
      payload: { ...tag, type: "label_rescan", text: LABEL_RESCAN_TEXT },
    });
  }
  if (fence.triggered) {
    toSave.push({
      householdId: input.householdId,
      kind: "fence",
      source: "system",
      status: "POR_CONFIRMAR",
      confidence: null,
      payload: { ...tag, context: "photo", emergency: fence.emergency, matches: fence.matches, copy: fence.copy },
    });
  }

  const events: QuidaEvent[] = [];
  for (const e of toSave) {
    const saved = await store.create(e);
    // A store may keep a large photo out (Redis over 300 KB); the phone that took it still gets it back.
    events.push(saved.payload.image_omitted ? { ...saved, payload: { ...saved.payload, image } } : saved);
  }

  return {
    simulated,
    class: extraction.class,
    trusted: trust.trusted,
    badge: trust.badge,
    fields: trust.fields,
    expires_on,
    unreadable_lines: extraction.unreadable_lines,
    fence,
    message: trust.fields ? null : "No encontramos una receta ni un referido en esta foto. Intente con otra foto.",
    events,
  };
}
