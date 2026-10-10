import { createOpenAI } from "@ai-sdk/openai";
import { gateway, type LanguageModel, type TranscriptionModel } from "ai";

export type ProviderName = "gateway" | "openai";

export type Candidate<M> = { provider: ProviderName; model: M };

const DEFAULT_OPENAI_TEXT_MODEL = "gpt-4o";
const DEFAULT_OPENAI_TRANSCRIBE_MODEL = "gpt-4o-transcribe";

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function openaiProvider() {
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Language models to try, in order: the Vercel AI Gateway first, then OpenAI
 * direct when `OPENAI_API_KEY` is set. `OPENAI_TEXT_MODEL` overrides the id.
 */
export function textModels(gatewayModelId: string): Candidate<LanguageModel>[] {
  const models: Candidate<LanguageModel>[] = [{ provider: "gateway", model: gateway(gatewayModelId) }];
  if (hasOpenAIKey()) {
    const id = process.env.OPENAI_TEXT_MODEL || DEFAULT_OPENAI_TEXT_MODEL;
    models.push({ provider: "openai", model: openaiProvider()(id) });
  }
  return models;
}

/**
 * Transcription models to try, in the same order. `OPENAI_TRANSCRIBE_MODEL`
 * overrides the OpenAI id.
 */
export function transcriptionModels(gatewayModelId: string): Candidate<TranscriptionModel>[] {
  const models: Candidate<TranscriptionModel>[] = [{ provider: "gateway", model: gateway.transcription(gatewayModelId) }];
  if (hasOpenAIKey()) {
    const id = process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_OPENAI_TRANSCRIBE_MODEL;
    models.push({ provider: "openai", model: openaiProvider().transcription(id) });
  }
  return models;
}

/**
 * Runs `run` against each candidate in order and returns the first success.
 * Every failure is logged with the provider name; when all fail, the last
 * error is thrown so the caller's existing fixture fallback takes over.
 */
export async function firstThatWorks<T, M>(
  label: string,
  candidates: Candidate<M>[],
  run: (model: M) => Promise<T>,
): Promise<{ value: T; provider: ProviderName }> {
  if (candidates.length === 0) throw new Error(`${label}: no AI providers configured`);
  let lastError: unknown;
  for (const c of candidates) {
    try {
      return { value: await run(c.model), provider: c.provider };
    } catch (err) {
      lastError = err;
      console.warn(label, "provider failed", c.provider, err instanceof Error ? err.message : String(err));
    }
  }
  throw lastError;
}
