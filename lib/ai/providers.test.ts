import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstThatWorks, textModels, transcriptionModels } from "./providers";

const saved = process.env.OPENAI_API_KEY;
beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  if (saved === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved;
  vi.restoreAllMocks();
});

const candidates = [
  { provider: "gateway" as const, model: "g" },
  { provider: "openai" as const, model: "o" },
];

describe("firstThatWorks", () => {
  it("returns the first candidate when it succeeds", async () => {
    const run = vi.fn(async (m: string) => `ok:${m}`);
    await expect(firstThatWorks("t", candidates, run)).resolves.toEqual({ value: "ok:g", provider: "gateway" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls through to openai when the gateway throws", async () => {
    const run = vi.fn(async (m: string) => {
      if (m === "g") throw Object.assign(new Error("customer_verification_required"), { statusCode: 403 });
      return `ok:${m}`;
    });
    await expect(firstThatWorks("t", candidates, run)).resolves.toEqual({ value: "ok:o", provider: "openai" });
    expect(run).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith("t", "provider failed", "gateway", "customer_verification_required");
  });

  it("rethrows the last error when every candidate fails", async () => {
    const run = vi.fn(async (m: string) => {
      throw new Error(`fail:${m}`);
    });
    await expect(firstThatWorks("t", candidates, run)).rejects.toThrow("fail:o");
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("model lists", () => {
  it("only lists the gateway without OPENAI_API_KEY", () => {
    expect(textModels("anthropic/claude-sonnet-5.5").map((c) => c.provider)).toEqual(["gateway"]);
    expect(transcriptionModels("openai/gpt-4o-transcribe").map((c) => c.provider)).toEqual(["gateway"]);
  });

  it("adds openai after the gateway when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(textModels("anthropic/claude-sonnet-5.5").map((c) => c.provider)).toEqual(["gateway", "openai"]);
    expect(transcriptionModels("openai/gpt-4o-transcribe").map((c) => c.provider)).toEqual(["gateway", "openai"]);
    delete process.env.OPENAI_API_KEY;
    expect(textModels("anthropic/claude-sonnet-5.5")).toHaveLength(1);
  });
});
