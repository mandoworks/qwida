import type { QuidaEvent } from "@/lib/store/types";

/**
 * The state of "Aprobar y enviar a Mamá". Kept apart from the generic `busy`
 * flag so the family member never sees "Enviando…" over a failed request, and so a
 * retry is always available.
 */
export type SendState = "idle" | "sending" | "sent" | "failed";

export type SendAction =
  /** The tap on "Aprobar y enviar a Mamá". */
  | { type: "send" }
  /** The POST came back ok. */
  | { type: "ok" }
  /** The POST failed, threw, or came back not ok. */
  | { type: "fail" }
  /** Any edit to the card: the sent seal no longer describes what is on screen. */
  | { type: "edit" };

/**
 * Pure send machine. "sending" only ever follows a tap, and a response only
 * counts while a request is in flight, so a late or duplicate response cannot
 * flip a settled state.
 */
export function sendReducer(state: SendState, action: SendAction): SendState {
  switch (action.type) {
    case "send":
      return state === "sending" ? state : "sending";
    case "ok":
      return state === "sending" ? "sent" : state;
    case "fail":
      return state === "sending" ? "failed" : state;
    case "edit":
      return state === "sent" ? "idle" : state;
  }
}

/** The button is live only after Aprobar and while nothing else is in flight. */
export function canSend(input: {
  approved: boolean;
  state: SendState;
  emergency: boolean;
  /** The draft generator is running, it would overwrite the card mid send. */
  busy?: boolean;
}): boolean {
  return input.approved && !input.emergency && !input.busy && input.state !== "sending";
}

/**
 * Folds an event the family member just created into the polled list so the screen
 * is right on the next frame instead of up to two seconds later. Same shape the
 * poll produces: newest `updatedAt` wins, sorted by `createdAt`.
 */
export function mergeEvent(base: QuidaEvent[], incoming: QuidaEvent | null): QuidaEvent[] {
  if (!incoming) return base;
  const byId = new Map(base.map((e) => [e.id, e]));
  const current = byId.get(incoming.id);
  if (!current || current.updatedAt <= incoming.updatedAt) byId.set(incoming.id, incoming);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}