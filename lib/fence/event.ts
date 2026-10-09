import type { NewEvent } from "@/lib/store/types";
import type { FenceResult } from "./index";

/**
 * The `fence` event that routes a tripwire to the caregiver. Always
 * POR_CONFIRMAR from `system`: a person must look at it.
 */
export function fenceEvent(
  householdId: string,
  fence: FenceResult,
  info: { context: "visit" | "note" | "question"; simulated: boolean } & Record<string, unknown>,
): NewEvent {
  return {
    householdId,
    kind: "fence",
    source: "system",
    status: "POR_CONFIRMAR",
    confidence: null,
    payload: {
      synthetic: true,
      ...info,
      emergency: fence.emergency,
      matches: fence.matches,
      copy: fence.copy,
    },
  };
}
