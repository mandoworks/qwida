import { HOUSEHOLD_ID, seedEvents } from "@/lib/seed";
import { MockStore } from "./mock";
import { redisEnv, RedisStore } from "./redis";
import type { EventStore } from "./types";

export * from "./types";

const globalForStore = globalThis as unknown as { quidaStore?: Promise<EventStore> };

/**
 * `redis` when QUIDA_STORE=redis, or when the Upstash env vars exist and
 * QUIDA_STORE is not `mock`. Otherwise the in memory mock.
 */
export function storeKind(): "redis" | "mock" {
  const kind = process.env.QUIDA_STORE;
  if (kind === "redis" || (kind !== "mock" && redisEnv())) return "redis";
  return "mock";
}

async function createStore(): Promise<EventStore> {
  const kind = storeKind();
  console.info(`[quida] event store: ${kind}`);
  if (kind === "redis") {
    const store = RedisStore.fromEnv();
    // Seeds only a household that was never reset, so a cold instance never wipes shared state.
    await store.ensureSeeded(HOUSEHOLD_ID, seedEvents());
    return store;
  }
  const store = new MockStore();
  await store.reset(seedEvents());
  return store;
}

/** Server only. One store per server process, seeded on first use. A failed start is retried on the next call. */
export function getStore(): Promise<EventStore> {
  globalForStore.quidaStore ??= createStore().catch((err) => {
    globalForStore.quidaStore = undefined;
    throw err;
  });
  return globalForStore.quidaStore;
}
