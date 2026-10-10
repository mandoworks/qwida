import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getSubscribe } from "@/app/api/push/subscribe/route";
import { POST as postTest } from "@/app/api/push/test/route";
import { sendItems } from "@/lib/push/send";
import { vapidConfig } from "@/lib/push/store";

describe("web push 'no keys' behavior", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("vapidConfig returns null when keys are not set in environment", () => {
    expect(vapidConfig()).toBeNull();
  });

  it("vapidConfig returns null when only one key is set", () => {
    process.env.VAPID_PUBLIC_KEY = "dummy-public-key";
    expect(vapidConfig()).toBeNull();
  });

  it("/api/push/subscribe GET returns publicKey null without crashing", async () => {
    const res = await getSubscribe();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; publicKey: string | null };
    expect(json.ok).toBe(true);
    expect(json.publicKey).toBeNull();
  });

  it("sendItems safely returns 0 delivered notifications when no keys are configured", async () => {
    const delivered = await sendItems("household-123", [
      {
        tag: "test:tag",
        title: "Test",
        body: "Test body",
        url: "/familia/revisar",
      },
    ]);
    expect(delivered).toBe(0);
  });

  it("/api/push/test POST safely executes and returns 0 delivered when no keys are configured", async () => {
    const res = await postTest();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; delivered: number };
    expect(json.ok).toBe(true);
    expect(json.delivered).toBe(0);
  });
});
