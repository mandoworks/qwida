import { z } from "zod";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { EventStatus, getStore, NewEvent } from "@/lib/store";

const ListQuery = z.object({
  householdId: z.string().min(1).default(HOUSEHOLD_ID),
  since: z.iso.datetime().optional(),
});

/**
 * GET /api/events?since=ISO&householdId=...
 * Clients poll every 2 seconds with `since` set to the returned `cursor`.
 * If `resetAt` changes between polls, drop local state and fetch without `since`.
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = ListQuery.safeParse(params);
  if (!query.success) {
    return Response.json({ error: z.treeifyError(query.error) }, { status: 400 });
  }
  const store = await getStore();
  const events = await store.list(query.data.householdId, query.data.since);
  const cursor = events.at(-1)?.updatedAt ?? query.data.since ?? null;
  return Response.json({ events, cursor, resetAt: await store.lastResetAt() });
}

/** POST /api/events with a NewEvent body. */
export async function POST(request: Request) {
  const body = NewEvent.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  const store = await getStore();
  const event = await store.create(body.data);
  return Response.json({ event }, { status: 201 });
}

const PatchBody = z
  .object({
    id: z.string().min(1),
    status: EventStatus.optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => b.status !== undefined || b.payload !== undefined, {
    message: "status or payload required",
  });

/** PATCH /api/events with { id, status?, payload? }. Payload merges shallowly. */
export async function PATCH(request: Request) {
  const body = PatchBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  const store = await getStore();
  const { id, ...patch } = body.data;
  const event = await store.update(id, patch);
  if (!event) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ event });
}
