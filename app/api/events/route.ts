import { z } from "zod";
import { checkFence } from "@/lib/fence";
import { fenceEvent } from "@/lib/fence/event";
import { whoFrom } from "@/lib/audit";
import { ConfirmedBy, gateCreate, gatePatch } from "@/lib/fence/gate";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { EventStatus, getStore, NewEvent } from "@/lib/store";

/** A NewEvent plus top level `confirmedBy`: who tapped. */
const CreateBody = NewEvent.extend({ confirmedBy: ConfirmedBy.optional() });

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

/**
 * POST /api/events with a NewEvent body, plus `confirmedBy` when status is
 * CONFIRMADO (see lib/fence/gate.ts for which kinds may be created confirmed).
 * A `voice_note` with text runs the Fence; if it trips, a fence event is saved
 * too and returned as `fence`.
 */
export async function POST(request: Request) {
  const body = CreateBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  const { confirmedBy, ...input } = body.data;
  const gate = gateCreate(input, confirmedBy, new Date(), whoFrom(request, input.householdId, confirmedBy));
  if (!gate.ok) return Response.json({ error: gate.error }, { status: 403 });

  const store = await getStore();
  const event = await store.create({ ...input, payload: gate.payload });
  const text = event.kind === "voice_note" ? event.payload.text : undefined;
  if (typeof text === "string") {
    const fence = checkFence(text);
    if (fence.triggered) {
      const info = { context: "note" as const, simulated: event.payload.simulated === true, noteId: event.id, transcript: text };
      await store.create(fenceEvent(event.householdId, fence, info));
      return Response.json({ event, fence }, { status: 201 });
    }
  }
  return Response.json({ event }, { status: 201 });
}

const PatchBody = z
  .object({
    id: z.string().min(1),
    status: EventStatus.optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    confirmedBy: ConfirmedBy.optional(),
  })
  .refine((b) => b.status !== undefined || b.payload !== undefined, {
    message: "status or payload required",
  });

/**
 * PATCH /api/events with { id, status?, payload?, confirmedBy? }. Payload merges
 * shallowly. Status CONFIRMADO needs confirmedBy, recorded with the person's name,
 * device and a timestamp; every status change adds a line to `payload.history`.
 */
export async function PATCH(request: Request) {
  const body = PatchBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: z.treeifyError(body.error) }, { status: 400 });
  }
  const { id, confirmedBy, status, payload } = body.data;
  const store = await getStore();
  const current = await store.get(id);
  if (!current) return Response.json({ error: "not found" }, { status: 404 });
  const gate = gatePatch({ status, payload }, confirmedBy, new Date(), whoFrom(request, current.householdId, confirmedBy));
  if (!gate.ok) return Response.json({ error: gate.error }, { status: 403 });
  const event = await store.update(id, { status, payload: gate.payload });
  if (!event) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ event });
}
