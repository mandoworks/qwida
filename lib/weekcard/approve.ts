import { HOUSEHOLD_ID } from "@/lib/seed";
import type { EventStore, NewEvent, QuidaEvent } from "@/lib/store/types";
import { cleanCard, type StrippedCard } from "./safety";

export type ApproveResult = StrippedCard & { event: QuidaEvent };

/**
 * The family member tapped "Aprobar y enviar a Mamá". This is the only path that
 * writes a CONFIRMADO `weekcard`, so nothing reaches the patient side without a
 * human tap. The Fence still runs here: advice about medicines is dropped and
 * reported back instead of being sent.
 */
export async function approveCard(
  store: EventStore,
  card: Parameters<typeof cleanCard>[0],
  input: { householdId?: string; simulated?: boolean } = {},
): Promise<ApproveResult> {
  const clean = cleanCard(card);
  const payload: NewEvent["payload"] = {
    synthetic: true,
    simulated: input.simulated === true,
    ...clean.card,
    removedMedAdvice: clean.removed,
  };
  const event = await store.create({
    householdId: input.householdId ?? HOUSEHOLD_ID,
    kind: "weekcard",
    status: "CONFIRMADO",
    source: "familia",
    confidence: 1,
    payload,
  });
  return { ...clean, event };
}
