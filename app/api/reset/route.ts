import { seedEvents } from "@/lib/seed";
import { getStore } from "@/lib/store";

/** POST /api/reset wipes shared state and reloads the synthetic Doña Carmen case. */
export async function POST() {
  const store = await getStore();
  await store.reset(seedEvents());
  return Response.json({ ok: true, resetAt: await store.lastResetAt() });
}
