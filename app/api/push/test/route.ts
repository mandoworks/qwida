import { HOUSEHOLD_ID } from "@/lib/seed";
import type { PushItem } from "@/lib/push/items";
import { sendItems } from "@/lib/push/send";

/**
 * POST /api/push/test sends the shape of a real visit to this household's
 * caregiver phones: three separate alerts, so the stack can be checked without
 * recording a visit first. Synthetic, like everything in the demo.
 */
const SAMPLE: PushItem[] = [
  {
    tag: "prueba:rx",
    title: "Medicina nueva",
    body: "losartán 50 mg. Confirme la dosis antes de mandársela a Mamá.",
    url: "/familia/revisar",
  },
  {
    tag: "prueba:ref",
    title: "Hay un referido",
    body: "cardiología, vence el 7 de enero. Confírmelo para empezar los 90 días.",
    url: "/familia/revisar",
  },
  {
    tag: "prueba:q",
    title: "Una pregunta para usted",
    body: "¿Qué dosis de omeprazol le recetó el médico?",
    url: "/familia/revisar",
  },
];

export async function POST() {
  const delivered = await sendItems(HOUSEHOLD_ID, SAMPLE);
  return Response.json({ ok: true, delivered });
}
