import { seedEvents } from "@/lib/seed";
import { MockStore } from "./mock";
import type { EventStore } from "./types";

export * from "./types";

const globalForStore = globalThis as unknown as { quidaStore?: Promise<EventStore> };

async function createStore(): Promise<EventStore> {
  const kind = process.env.QUIDA_STORE ?? "mock";
  switch (kind) {
    case "mock": {
      const store = new MockStore();
      await store.reset(seedEvents());
      return store;
    }
    // case "postgres": the lead picks the real backend later; add it here.
    default:
      throw new Error(`QUIDA_STORE=${kind} is not implemented`);
  }
}

/** Server only. One store per server process, seeded on first use. */
export function getStore(): Promise<EventStore> {
  globalForStore.quidaStore ??= createStore();
  return globalForStore.quidaStore;
}
