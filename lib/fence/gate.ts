import { z } from "zod";
import type { EventKind, EventSource, EventStatus } from "@/lib/store/types";

/** Who tapped. Only a person can move an event to CONFIRMADO. */
export const ConfirmedBy = z.enum(["patient", "familia"]);
export type ConfirmedBy = z.infer<typeof ConfirmedBy>;

/**
 * Kinds that POST /api/events may create already CONFIRMADO, each the result
 * of a human tap: the family member approving the week card, a med schedule from
 * the photo confirm route (it carries `fromEventId`), and the family member's
 * one tap "llamar para cita" nudge on /proveedores.
 */
const CREATE_CONFIRMED: Partial<Record<EventKind, (payload: Record<string, unknown>, by: ConfirmedBy) => boolean>> = {
  weekcard: (_, by) => by === "familia",
  med_schedule: (payload) => typeof payload.fromEventId === "string" && payload.fromEventId !== "",
  nudge: (_, by) => by === "familia",
};

export type GateResult = { ok: true; payload: Record<string, unknown> } | { ok: false; error: string };

/** Clients cannot write these keys; the gate sets them. */
function strip(payload: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...payload };
  delete rest.confirmedBy;
  delete rest.confirmedAt;
  return rest;
}

function stamp(payload: Record<string, unknown>, by: ConfirmedBy, now: Date) {
  return { ...payload, confirmedBy: by, confirmedAt: now.toISOString() };
}

const NEEDS_PERSON = 'CONFIRMADO necesita confirmedBy: "patient" o "familia".';

/** Gate for POST /api/events. Model output can never arrive as CONFIRMADO. */
export function gateCreate(
  input: { kind: EventKind; source: EventSource; status: EventStatus; payload: Record<string, unknown> },
  confirmedBy: ConfirmedBy | undefined,
  now = new Date(),
): GateResult {
  const payload = strip(input.payload);
  if (input.status !== "CONFIRMADO") return { ok: true, payload };
  if (!confirmedBy) return { ok: false, error: NEEDS_PERSON };
  const allowed = CREATE_CONFIRMED[input.kind];
  if (input.source === "system" || !allowed || !allowed(payload, confirmedBy)) {
    return { ok: false, error: `No se puede crear un ${input.kind} ya CONFIRMADO. Créelo como BORRADOR y confírmelo.` };
  }
  return { ok: true, payload: stamp(payload, confirmedBy, now) };
}

/** Gate for PATCH /api/events. Any kind may be confirmed, but only by a person. */
export function gatePatch(
  patch: { status?: EventStatus; payload?: Record<string, unknown> },
  confirmedBy: ConfirmedBy | undefined,
  now = new Date(),
): { ok: true; payload?: Record<string, unknown> } | { ok: false; error: string } {
  const payload = patch.payload && strip(patch.payload);
  if (patch.status !== "CONFIRMADO") return { ok: true, payload };
  if (!confirmedBy) return { ok: false, error: NEEDS_PERSON };
  return { ok: true, payload: stamp(payload ?? {}, confirmedBy, now) };
}
