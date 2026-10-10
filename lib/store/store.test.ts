import type { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";
import { MockStore } from "./mock";
import { capImage, MAX_IMAGE_CHARS, RedisStore, TTL_SECONDS } from "./redis";
import type { EventStore, NewEvent } from "./types";

/** In memory stand in for the Upstash REST client: only the commands RedisStore uses. No network. */
class FakeRedis {
  hashes = new Map<string, Map<string, string>>();
  zsets = new Map<string, Map<string, number>>();
  strings = new Map<string, string>();
  ttl = new Map<string, number>();

  async hset(key: string, kv: Record<string, string>) {
    const h = this.hashes.get(key) ?? new Map<string, string>();
    for (const [f, v] of Object.entries(kv)) h.set(f, v);
    this.hashes.set(key, h);
    return Object.keys(kv).length;
  }
  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null;
  }
  /** With automaticDeserialization off, Upstash hands back the raw array of values. */
  async hmget(key: string, ...fields: string[]) {
    return fields.map((f) => this.hashes.get(key)?.get(f) ?? null);
  }
  async zadd(key: string, { score, member }: { score: number; member: string }) {
    const z = this.zsets.get(key) ?? new Map<string, number>();
    z.set(member, score);
    this.zsets.set(key, z);
    return 1;
  }
  async zrange(key: string, min: number, max: number, opts: { byScore: true }) {
    expect(opts.byScore).toBe(true);
    return [...(this.zsets.get(key) ?? new Map<string, number>())]
      .filter(([, s]) => s >= min && s <= max)
      .sort((a, b) => a[1] - b[1])
      .map(([m]) => m);
  }
  async del(...keys: string[]) {
    for (const k of keys) {
      this.hashes.delete(k);
      this.zsets.delete(k);
      this.strings.delete(k);
      this.ttl.delete(k);
    }
    return keys.length;
  }
  async expire(key: string, seconds: number) {
    const exists = this.hashes.has(key) || this.zsets.has(key) || this.strings.has(key);
    if (exists) this.ttl.set(key, seconds);
    return exists ? 1 : 0;
  }
  async set(key: string, value: string, opts: { nx?: boolean; ex?: number } = {}) {
    if (opts.nx && this.strings.has(key)) return null;
    this.strings.set(key, value);
    if (opts.ex) this.ttl.set(key, opts.ex);
    return "OK";
  }
  async get(key: string) {
    return this.strings.get(key) ?? null;
  }
  pipeline() {
    const ops: (() => Promise<unknown>)[] = [];
    const p = new Proxy({} as Record<string, unknown>, {
      get: (_, name: string) => {
        if (name === "exec") return async () => { const out = []; for (const op of ops) out.push(await op()); return out; };
        return (...args: unknown[]) => {
          ops.push(() => (this as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[name](...args));
          return p;
        };
      },
    });
    return p;
  }
}

const redisStore = (lookback = 0) => {
  const fake = new FakeRedis();
  return { fake, store: new RedisStore(fake as unknown as Redis, lookback) };
};

const ev = (householdId: string, payload: Record<string, unknown> = {}): NewEvent => ({
  householdId,
  kind: "nudge",
  source: "system",
  payload,
});

const stores: [string, () => EventStore][] = [
  ["MockStore", () => new MockStore()],
  ["RedisStore (fake Upstash)", () => redisStore().store],
];

describe.each(stores)("EventStore contract: %s", (_, make) => {
  it("creates with defaults", async () => {
    const e = await make().create(ev("h", { a: 1 }));
    expect(e).toMatchObject({ householdId: "h", status: "BORRADOR", confidence: null, payload: { a: 1 } });
    expect(e.createdAt).toBe(e.updatedAt);
  });

  it("lists oldest first, per household", async () => {
    const s = make();
    const a = await s.create(ev("h"));
    const b = await s.create(ev("h"));
    await s.create(ev("other"));
    expect((await s.list("h")).map((e) => e.id)).toEqual([a.id, b.id]);
    expect(await s.list("nobody")).toEqual([]);
  });

  it("returns only events changed after since", async () => {
    const s = make();
    const a = await s.create(ev("h"));
    const b = await s.create(ev("h"));
    expect((await s.list("h", a.updatedAt)).map((e) => e.id)).toEqual([b.id]);
    expect(await s.list("h", b.updatedAt)).toEqual([]);
  });

  it("update sets status, merges payload shallowly and is seen by since polling", async () => {
    const s = make();
    const a = await s.create(ev("h", { keep: 1, nested: { x: 1 } }));
    const b = await s.create(ev("h"));
    const u = await s.update(a.id, { status: "CONFIRMADO", payload: { nested: { y: 2 }, added: true } });
    expect(u).toMatchObject({ status: "CONFIRMADO", payload: { keep: 1, nested: { y: 2 }, added: true } });
    expect(u!.updatedAt > b.updatedAt).toBe(true);
    expect((await s.list("h", b.updatedAt)).map((e) => e.id)).toEqual([a.id]);
  });

  it("updateStatus still works and unknown ids return null", async () => {
    const s = make();
    const a = await s.create(ev("h", { p: 1 }));
    expect(await s.updateStatus(a.id, "POR_CONFIRMAR")).toMatchObject({ status: "POR_CONFIRMAR", payload: { p: 1 } });
    expect(await s.update("missing", { status: "CONFIRMADO" })).toBeNull();
    expect(await s.updateStatus("missing", "CONFIRMADO")).toBeNull();
  });

  it("rejects an invalid status", async () => {
    const s = make();
    const a = await s.create(ev("h"));
    await expect(s.update(a.id, { status: "HECHO" as never })).rejects.toThrow();
  });

  it("reset wipes the household, loads the seed and moves lastResetAt", async () => {
    const s = make();
    await s.create(ev("h", { old: true }));
    const before = await s.lastResetAt("h");
    await s.reset([ev("h", { seed: 1 }), ev("h", { seed: 2 })]);
    expect(await s.list("h")).toMatchObject([{ payload: { seed: 1 } }, { payload: { seed: 2 } }]);
    expect(await s.list("h")).toHaveLength(2);
    expect((await s.lastResetAt("h")) > before).toBe(true);
  });

  it("get returns one event by id, or null", async () => {
    const s = make();
    const a = await s.create(ev("h", { p: 1 }));
    expect(await s.get(a.id)).toMatchObject({ id: a.id, payload: { p: 1 } });
    expect(await s.get("missing")).toBeNull();
  });

  it("keeps a paper trail: create starts it, each status change appends, a payload edit does not", async () => {
    const s = make();
    const a = await s.create(ev("h", { p: 1 }));
    expect(a.payload.history).toEqual([{ status: "BORRADOR", at: a.createdAt, by: null, name: null, device: null }]);
    await s.update(a.id, { payload: { p: 2 } });
    const stamp = { confirmedBy: "caregiver", confirmedName: "Marisol Rivera", confirmedDevice: "iPhone" };
    const u = await s.update(a.id, { status: "CONFIRMADO", payload: stamp });
    expect(u!.payload.history).toEqual([
      { status: "BORRADOR", at: a.createdAt, by: null, name: null, device: null },
      { status: "CONFIRMADO", at: u!.updatedAt, by: "caregiver", name: "Marisol Rivera", device: "iPhone" },
    ]);
  });

  it("never lets a payload patch replace the trail", async () => {
    const s = make();
    const a = await s.create(ev("h"));
    const u = await s.update(a.id, { status: "POR_CONFIRMAR", payload: { history: [] } });
    expect(u!.payload.history).toHaveLength(2);
    const v = await s.update(a.id, { payload: { history: [] } });
    expect(v!.payload.history).toHaveLength(2);
  });

  it("returns copies, not live references", async () => {
    const s = make();
    const a = await s.create(ev("h", { v: 1 }));
    a.payload.v = 99;
    (await s.list("h"))[0].payload.v = 98;
    expect((await s.list("h"))[0].payload.v).toBe(1);
  });
});

describe("RedisStore specifics", () => {
  it("sets a 7 day TTL on every key it writes", async () => {
    const { fake, store } = redisStore();
    await store.reset([ev("h")]);
    for (const k of ["quida:h:events", "quida:h:updated", "quida:h:resetAt", "quida:index"]) {
      expect(fake.ttl.get(k)).toBe(TTL_SECONDS);
    }
  });

  it("seeds a household once, even when called again by another cold instance", async () => {
    const { fake, store } = redisStore();
    await store.ensureSeeded("h", [ev("h", { seed: 1 })]);
    await store.create(ev("h", { live: 1 }));
    await new RedisStore(fake as unknown as Redis, 0).ensureSeeded("h", [ev("h", { seed: 1 })]);
    expect(await store.list("h")).toMatchObject([{ payload: { seed: 1 } }, { payload: { live: 1 } }]);
    expect(await store.list("h")).toHaveLength(2);
  });

  it("keeps oversized photos out of Redis", async () => {
    const { store } = redisStore();
    const big = "data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_CHARS);
    const e = await store.create(ev("h", { image: big, drug: "losartán" }));
    expect(e.payload).toMatchObject({ image: null, image_omitted: true, drug: "losartán" });
    expect(capImage({ image: "data:small" })).toEqual({ image: "data:small" });
  });

  it("re-reads a short window before since so a late write on another instance is not missed", async () => {
    const { store } = redisStore(5_000);
    const a = await store.create(ev("h"));
    const b = await store.create(ev("h"));
    expect((await store.list("h", b.updatedAt)).map((e) => e.id)).toEqual([a.id, b.id]);
  });
});
