import { z } from "zod";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { deleteSubscription, saveSubscription } from "@/lib/push/store";

/**
 * POST   /api/push/subscribe { subscription }  saves a caregiver phone.
 * DELETE /api/push/subscribe { endpoint }      forgets one.
 * GET    /api/push/subscribe                  returns the VAPID public key the
 *                                              browser needs to subscribe.
 */
const Body = z.object({
  subscription: z.object({}).passthrough().optional(),
  endpoint: z.string().optional(),
});

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? null;
  return Response.json({ ok: true, publicKey });
}

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  const householdId = HOUSEHOLD_ID;
  if (body.data.subscription) {
    const saved = await saveSubscription(householdId, body.data.subscription);
    return Response.json({ ok: saved }, { status: saved ? 201 : 400 });
  }
  if (body.data.endpoint) {
    await deleteSubscription(householdId, body.data.endpoint);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Falta la subscription." }, { status: 400 });
}
