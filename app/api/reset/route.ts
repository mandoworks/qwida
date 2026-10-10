import { checkFence } from "@/lib/fence";
import { HOUSEHOLD_ID, seedEvents } from "@/lib/seed";
import { getStore } from "@/lib/store";
import { FIXTURE_EXTRACTION, FIXTURE_TRANSCRIPT } from "@/lib/visit/fixture";
import { saveVisit } from "@/lib/visit/pipeline";

/**
 * POST /api/reset wipes shared state and reloads the synthetic Doña Carmen case.
 * `?mode=full` also preloads the recorded visit (labeled SIMULADO) waiting for
 * Familia to review, so a judge exploring alone sees the whole loop filled in.
 */
export async function POST(req: Request) {
  const full = new URL(req.url).searchParams.get("mode") === "full";
  const store = await getStore();
  await store.reset(seedEvents());
  if (full) {
    await saveVisit(store, HOUSEHOLD_ID, {
      transcript: FIXTURE_TRANSCRIPT,
      fence: checkFence(FIXTURE_TRANSCRIPT),
      extraction: FIXTURE_EXTRACTION,
      simulated: true,
      consent: { patient: true, doctor: true, at: new Date().toISOString(), device: null },
    });
  }
  return Response.json({ ok: true, mode: full ? "full" : "live", resetAt: await store.lastResetAt() });
}
