import { readFileSync } from "node:fs";
import { generateText, transcribe } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FENCE_COPY } from "@/lib/fence";
import { MockStore } from "@/lib/store/mock";
import { NOTE_FIXTURES, NOTE_UNTRANSCRIBED, processNote } from "./index";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
  transcribe: vi.fn(async () => ({ text: "Me caí en el baño y no me puedo parar" })),
}));

const saved = { key: process.env.AI_GATEWAY_API_KEY, oidc: process.env.VERCEL_OIDC_TOKEN };
beforeEach(() => {
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  vi.mocked(transcribe).mockClear();
  vi.mocked(generateText).mockClear();
});
afterEach(() => {
  if (saved.key !== undefined) process.env.AI_GATEWAY_API_KEY = saved.key;
  if (saved.oidc !== undefined) process.env.VERCEL_OIDC_TOKEN = saved.oidc;
});

const audio = new Uint8Array([1, 2, 3]);

describe("processNote without a key", () => {
  it("nota-fence.mp3 trips the Fence and saves the note plus a fence event", async () => {
    const store = new MockStore();
    const r = await processNote(store, { householdId: "h", audio, filename: "nota-fence.mp3", durationSec: 8 });
    expect(r.simulated).toBe(true);
    expect(r.transcript).toBe(NOTE_FIXTURES["nota-fence"]);
    expect(r.fence.medChange).toBe(true);
    expect(r.fence.copy).toEqual([FENCE_COPY.medChange]);
    expect(r.events.map((e) => e.kind)).toEqual(["voice_note", "fence"]);
    expect(r.events[0]).toMatchObject({ status: "POR_CONFIRMAR", source: "voice" });
    expect(r.events[0].payload).toMatchObject({ text: r.transcript, durationSec: 8, simulated: true });
    expect(r.events[1]).toMatchObject({ status: "POR_CONFIRMAR", source: "system" });
    expect(r.events[1].payload).toMatchObject({ context: "note", noteId: r.events[0].id });
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("nota-cita.mp3 is a calm note: one voice_note, no fence", async () => {
    const store = new MockStore();
    const r = await processNote(store, { householdId: "h", audio, filename: "/demo/nota-cita.mp3" });
    expect(r.transcript).toBe(NOTE_FIXTURES["nota-cita"]);
    expect(r.fence.triggered).toBe(false);
    expect(r.events.map((e) => e.kind)).toEqual(["voice_note"]);
  });

  it("an unknown recording does not get invented words", async () => {
    const r = await processNote(new MockStore(), { householdId: "h", audio, filename: "blob.webm" });
    expect(r.transcript).toBe(NOTE_UNTRANSCRIBED);
    expect(r.fence.triggered).toBe(false);
  });

  it("fences typed text as typed", async () => {
    const r = await processNote(new MockStore(), { householdId: "h", transcript: "Estoy sangrando" });
    expect(r.fence.emergency).toBe(true);
    expect(r.fence.copy[0]).toBe(FENCE_COPY.emergency);
  });
});

describe("processNote with a key", () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
  });

  it("transcribes, fences, and never calls a text model", async () => {
    const r = await processNote(new MockStore(), { householdId: "h", audio, filename: "nota.webm" });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(generateText).not.toHaveBeenCalled();
    expect(r.simulated).toBe(false);
    expect(r.fence.emergency).toBe(true);
    expect(r.events.map((e) => e.kind)).toEqual(["voice_note", "fence"]);
  });

  it("falls back to the SIMULADO fixture when transcription fails", async () => {
    vi.mocked(transcribe).mockRejectedValueOnce(new Error("gateway billing"));
    const r = await processNote(new MockStore(), { householdId: "h", audio, filename: "nota-fence.mp3" });
    expect(r.simulated).toBe(true);
    expect(r.transcript).toBe(NOTE_FIXTURES["nota-fence"]);
    expect(r.fence.medChange).toBe(true);
  });
});

describe("POST /api/note", () => {
  it("takes the demo file and returns { simulated, transcript, fence, events }", async () => {
    process.env.QUIDA_STORE = "mock";
    const { POST } = await import("@/app/api/note/route");
    const bytes = readFileSync(new URL("../../public/demo/nota-fence.mp3", import.meta.url));
    const form = new FormData();
    form.set("audio", new File([bytes], "nota-fence.mp3", { type: "audio/mpeg" }));
    form.set("durationSec", "8");
    const res = await POST(new Request("http://test/api/note", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["events", "fence", "simulated", "transcript"]);
    expect(body.transcript).toBe(NOTE_FIXTURES["nota-fence"]);
    expect(body.fence.triggered).toBe(true);
    expect(body.events.map((e: { kind: string }) => e.kind)).toEqual(["voice_note", "fence"]);
  });

  it("refuses an empty form", async () => {
    const { POST } = await import("@/app/api/note/route");
    const res = await POST(new Request("http://test/api/note", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });
});
