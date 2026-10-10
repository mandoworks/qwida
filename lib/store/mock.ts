import { appendHistory, historyEntry } from "./history";
import { EventStatus, NewEvent, type EventPatch, type EventStore, type QuidaEvent } from "./types";

/**
 * In-memory store for local dev and offline demos. State lives in the server
 * process, so it survives page reloads but not a server restart.
 */
export class MockStore implements EventStore {
  private events: QuidaEvent[] = [];
  private lastTick = 0;
  private resetAt = new Date(0).toISOString();

  /** Strictly increasing timestamps so `since` polling never skips a change. */
  private now(): string {
    const t = Math.max(Date.now(), this.lastTick + 1);
    this.lastTick = t;
    return new Date(t).toISOString();
  }

  async list(householdId: string, since?: string): Promise<QuidaEvent[]> {
    return this.events
      .filter((e) => e.householdId === householdId && (!since || e.updatedAt > since))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((e) => structuredClone(e));
  }

  async create(input: NewEvent): Promise<QuidaEvent> {
    const parsed = NewEvent.parse(input);
    const ts = this.now();
    const event: QuidaEvent = {
      id: crypto.randomUUID(),
      ...parsed,
      payload: { ...parsed.payload, history: [historyEntry(parsed.status, parsed.payload, ts)] },
      createdAt: ts,
      updatedAt: ts,
    };
    this.events.push(event);
    return structuredClone(event);
  }

  async get(id: string): Promise<QuidaEvent | null> {
    const event = this.events.find((e) => e.id === id);
    return event ? structuredClone(event) : null;
  }

  async update(id: string, patch: EventPatch): Promise<QuidaEvent | null> {
    const event = this.events.find((e) => e.id === id);
    if (!event) return null;
    const history = event.payload.history;
    if (patch.status) event.status = EventStatus.parse(patch.status);
    if (patch.payload) event.payload = { ...event.payload, ...structuredClone(patch.payload) };
    event.updatedAt = this.now();
    event.payload.history = patch.status
      ? appendHistory(history, historyEntry(event.status, patch.payload, event.updatedAt))
      : history;
    return structuredClone(event);
  }

  async updateStatus(id: string, status: EventStatus): Promise<QuidaEvent | null> {
    return this.update(id, { status });
  }

  async reset(seed: NewEvent[]): Promise<void> {
    this.events = [];
    this.resetAt = this.now();
    for (const e of seed) await this.create(e);
  }

  async lastResetAt(): Promise<string> {
    return this.resetAt;
  }
}
