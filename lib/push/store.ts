import { Redis } from "@upstash/redis";
import { redisEnv } from "@/lib/store/redis";

/** A browser push subscription, exactly as the Push API hands it over. */
export type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const KEY = (householdId: string) => `quida:push:${householdId}`;

/** Synthetic demo data: a caregiver phone is forgotten a week after subscribing. */
const TTL_SECONDS = 7 * 24 * 60 * 60;

function client(): Redis | null {
  const env = redisEnv();
  if (!env) return null;
  return new Redis({ ...env, automaticDeserialization: false });
}

/** VAPID keys from the env. Absent means nobody can receive a push yet. */
export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT ?? "mailto:hola@mando.works" };
}

function isSubscription(value: unknown): value is Subscription {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  const keys = s.keys as Record<string, unknown> | undefined;
  return (
    typeof s.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    typeof keys === "object" &&
    keys !== null &&
    typeof keys.p256dh === "string" &&
    typeof keys.auth === "string"
  );
}

/** Adds a caregiver phone. One phone per endpoint, so subscribing twice is harmless. */
export async function saveSubscription(householdId: string, sub: unknown): Promise<boolean> {
  if (!isSubscription(sub)) return false;
  const redis = client();
  if (!redis) return false;
  await redis.hset(KEY(householdId), { [sub.endpoint]: JSON.stringify(sub) });
  await redis.expire(KEY(householdId), TTL_SECONDS);
  return true;
}

/** A phone that unsubscribed, or whose browser dropped it. */
export async function deleteSubscription(householdId: string, endpoint: string): Promise<void> {
  const redis = client();
  if (!redis) return;
  await redis.hdel(KEY(householdId), endpoint);
}

export async function listSubscriptions(householdId: string): Promise<Subscription[]> {
  const redis = client();
  if (!redis) return [];
  const raw = await redis.hgetall<Record<string, string>>(KEY(householdId));
  if (!raw) return [];
  const out: Subscription[] = [];
  for (const [endpoint, json] of Object.entries(raw)) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (isSubscription(parsed)) out.push(parsed);
    } catch {
      // A row we cannot read is a row we drop: it will 410 on the next send.
      await deleteSubscription(householdId, endpoint);
    }
  }
  return out;
}
