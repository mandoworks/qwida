import type { EventStatus } from "./types";

/**
 * One line of an event's paper trail: the status it moved to, when, and who
 * tapped from which kind of device. Both stores append one on create and on
 * every status change, and never rewrite earlier lines.
 */
export type HistoryEntry = {
  status: EventStatus;
  at: string;
  /** "patient" or "caregiver" when a person tapped; null for a model or system write. */
  by: string | null;
  /** The person's name in the synthetic household, when known. */
  name: string | null;
  /** "iPhone", "Android", "Mac" and so on, from the request that made the change. */
  device: string | null;
};

const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The entry for a write that sets `status`, read from the confirmation stamp in the same payload. */
export function historyEntry(status: EventStatus, payload: Record<string, unknown> | undefined, at: string): HistoryEntry {
  return {
    status,
    at,
    by: text(payload?.confirmedBy),
    name: text(payload?.confirmedName),
    device: text(payload?.confirmedDevice),
  };
}

/** The previous history plus one entry; anything that is not a list starts a new one. */
export function appendHistory(previous: unknown, entry: HistoryEntry): HistoryEntry[] {
  return [...(Array.isArray(previous) ? (previous as HistoryEntry[]) : []), entry];
}
