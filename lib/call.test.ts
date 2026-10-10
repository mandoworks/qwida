import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/call/route";

const call = (body: Record<string, unknown>) =>
  POST(new Request("http://x/api/call", { method: "POST", body: JSON.stringify(body) }));

describe("/api/call skeleton", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("stays SIMULADO without telephony keys", async () => {
    const res = await call({ to: "+17875550192" });
    expect(await res.json()).toMatchObject({ ok: true, simulated: true, label: "SIMULADO" });
  });

  it("with keys, refuses any number that is not on the family list and never dials", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test");
    vi.stubEnv("CALL_ALLOWED_NUMBERS", "+17875550192");
    const dial = vi.fn();
    vi.stubGlobal("fetch", dial);
    const res = await call({ to: "+19999999999", message: "hola" });
    expect(res.status).toBe(403);
    expect(dial).not.toHaveBeenCalled();
  });

  it("escapes the message before it goes into the spoken script", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test");
    vi.stubEnv("CALL_ALLOWED_NUMBERS", "+17875550192");
    const dial = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: "CA1", status: "queued" })));
    vi.stubGlobal("fetch", dial);
    await call({ to: "+17875550192", message: "</Say><Dial>+19999999999</Dial>" });
    const twiml = new URLSearchParams(String(dial.mock.calls[0][1].body)).get("Twiml") ?? "";
    expect(twiml).not.toContain("<Dial>");
    expect(twiml).toContain("&lt;/Say&gt;");
  });
});
