import { z } from "zod";
import { whoFrom } from "@/lib/audit";
import { approveCard } from "@/lib/weekcard/approve";
import { cleanCard } from "@/lib/weekcard/safety";
import { WeekCard } from "@/lib/weekcard/schema";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

const Body = z.object({
  householdId: z.string().min(1).default(HOUSEHOLD_ID),
  simulated: z.boolean().default(false),
  card: WeekCard,
});

/**
 * POST /api/weekcard/approve with { householdId?, simulated?, card }.
 * Called from the "Aprobar y enviar a Mamá" tap. Runs the Fence on every line
 * and creates the CONFIRMADO `weekcard` event the patient side reads.
 * Returns { event, card, removed, emergency }.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  // Emergency words never go to the patient's card: a person has to look first.
  if (cleanCard(body.data.card).emergency) {
    return Response.json(
      { error: "Hay palabras de emergencia en la tarjeta. Revísela antes de enviarla." },
      { status: 422 },
    );
  }
  const store = await getStore();
  const result = await approveCard(store, body.data.card, {
    householdId: body.data.householdId,
    simulated: body.data.simulated,
    who: whoFrom(request, body.data.householdId, "caregiver"),
  });
  return Response.json(result);
}
