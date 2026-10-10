import { z } from "zod";
import { whoFrom } from "@/lib/audit";
import { confirmPhoto } from "@/lib/photo/confirm";
import { ConfirmBody } from "@/lib/photo/schema";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

/**
 * POST /api/photo/confirm with { eventId, householdId?, values?, confirmedBy? }.
 * Called only from a Confirmar tap. `values` holds the fields the person edited.
 * Returns { confirmed, created }: the photo event (now CONFIRMADO) and the new
 * CONFIRMADO med_schedule or referido. 422 with needsFrequency means ask how often.
 */
export async function POST(request: Request) {
  const body = ConfirmBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  const store = await getStore();
  const householdId = body.data.householdId ?? HOUSEHOLD_ID;
  const who = whoFrom(request, householdId, body.data.confirmedBy);
  const result = await confirmPhoto(store, { ...body.data, householdId }, undefined, who);
  if (!result.ok) {
    return Response.json({ error: result.error, needsFrequency: result.needsFrequency ?? false }, { status: result.status });
  }
  return Response.json({ confirmed: result.confirmed, created: result.created });
}
