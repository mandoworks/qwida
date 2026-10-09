import { z } from "zod";

export const EVENT_KINDS = [
  "visit",
  "rx_handwritten",
  "rx_label",
  "referido",
  "appointment",
  "med_schedule",
  "weekcard",
  "nudge",
  "fence",
  "voice_note",
] as const;

export const EVENT_STATUSES = ["BORRADOR", "POR_CONFIRMAR", "CONFIRMADO"] as const;

export const EVENT_SOURCES = ["voice", "photo", "familia", "system"] as const;

/**
 * Rows written before the rename carry `source: "caregiver"`. A deploy does not
 * rewrite the store (Redis rows survive, Supabase rows survive), so the read
 * schema still accepts the old value. New writes must use "familia".
 */
export const LEGACY_EVENT_SOURCE = "caregiver";

export const EventKind = z.enum(EVENT_KINDS);
export const EventStatus = z.enum(EVENT_STATUSES);
export const EventSource = z.union([z.enum(EVENT_SOURCES), z.literal(LEGACY_EVENT_SOURCE)]);

export type EventKind = z.infer<typeof EventKind>;
export type EventStatus = z.infer<typeof EventStatus>;
export type EventSource = z.infer<typeof EventSource>;

/** One row of shared care state. Mirrors the `events` table in the quida_app database. */
export const QuidaEvent = z.object({
  id: z.string(),
  householdId: z.string(),
  kind: EventKind,
  status: EventStatus,
  payload: z.record(z.string(), z.unknown()),
  source: EventSource,
  confidence: z.number().min(0).max(1).nullable(),
  /** ISO 8601 timestamp. */
  createdAt: z.string(),
  /** ISO 8601 timestamp of the last change. Polling uses this, so status updates are seen. */
  updatedAt: z.string(),
});
export type QuidaEvent = z.infer<typeof QuidaEvent>;

export const NewEvent = QuidaEvent.pick({
  householdId: true,
  kind: true,
  payload: true,
  source: true,
}).extend({
  status: EventStatus.default("BORRADOR"),
  confidence: z.number().min(0).max(1).nullable().default(null),
});
export type NewEvent = z.input<typeof NewEvent>;

export type EventPatch = { status?: EventStatus; payload?: Record<string, unknown> };

/**
 * Shared state contract. Every method is async so a Postgres or Redis
 * implementation can drop in without touching callers.
 */
export interface EventStore {
  /**
   * Events for a household changed after `since` (ISO timestamp, exclusive),
   * oldest first. Omit `since` for the full list.
   */
  list(householdId: string, since?: string): Promise<QuidaEvent[]>;
  create(input: NewEvent): Promise<QuidaEvent>;
  /** Sets status and shallow merges payload; bumps updatedAt. Returns null when the id does not exist. */
  update(id: string, patch: EventPatch): Promise<QuidaEvent | null>;
  /** Thin wrapper over update. Returns null when the id does not exist. */
  updateStatus(id: string, status: EventStatus): Promise<QuidaEvent | null>;
  /** Wipes everything and loads the given events (the synthetic seed). */
  reset(seed: NewEvent[]): Promise<void>;
  /** ISO timestamp of the last reset. Pollers drop local state when it changes. */
  lastResetAt(householdId?: string): Promise<string>;
}
