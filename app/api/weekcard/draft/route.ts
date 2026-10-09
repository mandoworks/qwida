import { z } from "zod";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";
import { todayPR } from "@/lib/photo/dates";
import { draftWeekCard } from "@/lib/weekcard/draft";

export const maxDuration = 30;

const Body = z.object({ householdId: z.string().min(1).default(HOUSEHOLD_ID) });

/**
 * POST /api/weekcard/draft with { householdId? }. Builds the week card draft
 * from the CONFIRMADO events: the model through the AI Gateway, or the
 * deterministic SIMULADO fixture when there is no key or the call fails.
 * Returns { card, simulated, removed, emergency }. Nothing is saved here; the
 * card becomes CONFIRMADO only after the caregiver taps send.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  try {
    const store = await getStore();
    const events = await store.list(body.data.householdId);
    const result = await draftWeekCard(events, todayPR());
    return Response.json(result);
  } catch (err) {
    console.error("week card draft failed", err);
    return Response.json({ error: "No pudimos armar la tarjeta. Intente otra vez." }, { status: 502 });
  }
}
