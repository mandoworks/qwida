import { Redis } from "@upstash/redis";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { EventStatus, NewEvent, type EventPatch, type EventStore, type QuidaEvent } from "./types";

/** Synthetic demo data: nothing is kept longer than a week. */
export const TTL_SECONDS = 7 * 24 * 60 * 60;

/** Upstash caps request size; photos above this stay only on the phone that took them. */
export const MAX_IMAGE_CHARS = 300_000;

/**
 * Polls re-read this much history before `since`, so an event written with a
 * slightly earlier clock on another instance (or landing a moment late) is never
 * skipped. Clients merge by id, so the overlap is harmless.
 */
export const LOOKBACK_MS = 5_000;

const EPOCH = new Date(0).toISOString();
const INDEX_KEY = "quida:index"; // event id to householdId, so update(id) finds the household

const keys = (householdId: string) => ({
  events: `quida:${householdId}:events`,
  updated: `quida:${householdId}:updated`,
  resetAt: `quida:${householdId}:resetAt`,
});

/** Upstash env vars from the Vercel integration, under either naming. Never logged. */
export function redisEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/** Replaces an oversized `payload.image` with a marker. */
export function capImage(payload: Record<string, unknown>): Record<string, unknown> {
  if (typeof payload.image === "string" && payload.image.length > MAX_IMAGE_CHARS) {
    return { ...payload, image: null, image_omitted: true };
  }
  return payload;
}

/**
 * Shared state in Upstash Redis, so every Vercel instance (and so both phones)
 * sees the same events. Per household: a hash of id to event JSON, a sorted set
 * of ids by updatedAt for `since` polling, and the last reset time.
 */
export class RedisStore implements EventStore {
  private lastTick = 0;

  constructor(
    private redis: Redis,
    private lookbackMs = LOOKBACK_MS,
  ) {}

  static fromEnv(): RedisStore {
    const env = redisEnv();
    if (!env) throw new Error("Redis env vars are not set");
    return new RedisStore(new Redis({ ...env, automaticDeserialization: false }));
  }

  private now(): number {
    this.lastTick = Math.max(Date.now(), this.lastTick + 1);
    return this.lastTick;
  }

  private async save(event: QuidaEvent): Promise<void> {
    const k = keys(event.householdId);
    await this.redis
      .pipeline()
      .hset(k.events, { [event.id]: JSON.stringify(event) })
      .zadd(k.updated, { score: Date.parse(event.updatedAt), member: event.id })
      .hset(INDEX_KEY, { [event.id]: event.householdId })
      .expire(k.events, TTL_SECONDS)
      .expire(k.updated, TTL_SECONDS)
      .expire(k.resetAt, TTL_SECONDS)
      .expire(INDEX_KEY, TTL_SECONDS)
      .exec();
  }

  async list(householdId: string, since?: string): Promise<QuidaEvent[]> {
    const k = keys(householdId);
    const min = since ? Date.parse(since) - this.lookbackMs : 0;
    const ids = await this.redis.zrange<string[]>(k.updated, min, Number.MAX_SAFE_INTEGER, { byScore: true });
    if (!ids.length) return [];
    // Raw array of JSON strings (automaticDeserialization is off); Object.values also covers the object form.
    const rows = await this.redis.hmget<Record<string, string | null>>(k.events, ...ids);
    return Object.values(rows ?? {})
      .filter((v): v is string => typeof v === "string")
      .map((v) => JSON.parse(v) as QuidaEvent)
      .filter((e) => !since || Date.parse(e.updatedAt) > min)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  async create(input: NewEvent): Promise<QuidaEvent> {
    const parsed = NewEvent.parse(input);
    const ts = new Date(this.now()).toISOString();
    const event: QuidaEvent = {
      id: crypto.randomUUID(),
      ...parsed,
      payload: capImage(parsed.payload),
      createdAt: ts,
      updatedAt: ts,
    };
    await this.save(event);
    return event;
  }

  async update(id: string, patch: EventPatch): Promise<QuidaEvent | null> {
    const householdId = await this.redis.hget<string>(INDEX_KEY, id);
    if (!householdId) return null;
    const raw = await this.redis.hget<string>(keys(householdId).events, id);
    if (!raw) return null;
    const event = JSON.parse(raw) as QuidaEvent;
    if (patch.status) event.status = EventStatus.parse(patch.status);
    if (patch.payload) event.payload = capImage({ ...event.payload, ...patch.payload });
    event.updatedAt = new Date(this.now()).toISOString();
    await this.save(event);
    return event;
  }

  async updateStatus(id: string, status: EventStatus): Promise<QuidaEvent | null> {
    return this.update(id, { status });
  }

  /** Wipes the seed's households and loads the seed. */
  async reset(seed: NewEvent[]): Promise<void> {
    const at = new Date(this.now()).toISOString();
    for (const householdId of new Set(seed.map((e) => e.householdId))) {
      const k = keys(householdId);
      await this.redis.del(k.events, k.updated);
      await this.redis.set(k.resetAt, at, { ex: TTL_SECONDS });
    }
    for (const e of seed) await this.create(e);
  }

  /**
   * Seeds a household only if it has never been reset (or its keys expired).
   * SET NX makes this safe when two cold instances start at once.
   */
  async ensureSeeded(householdId: string, seed: NewEvent[]): Promise<void> {
    const k = keys(householdId);
    const at = new Date(this.now()).toISOString();
    const won = await this.redis.set(k.resetAt, at, { nx: true, ex: TTL_SECONDS });
    if (won !== "OK") return;
    await this.redis.del(k.events, k.updated);
    for (const e of seed) await this.create(e);
  }

  /** Defaults to the demo household: the events and reset routes call this without one. */
  async lastResetAt(householdId = HOUSEHOLD_ID): Promise<string> {
    return (await this.redis.get<string>(keys(householdId).resetAt)) ?? EPOCH;
  }
}
