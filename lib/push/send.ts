import webpush from "web-push";
import type { QuidaEvent } from "@/lib/store/types";
import { itemsForEvents, type PushItem } from "./items";
import { deleteSubscription, listSubscriptions, vapidConfig } from "./store";

/** What the service worker receives. Kept small: a push payload has a size limit. */
export type PushPayload = {
  tag: string;
  title: string;
  body: string;
  url: string;
};

function toPayload(item: PushItem): PushPayload {
  return { tag: item.tag, title: item.title, body: item.body, url: item.url };
}

let configured = false;

/**
 * Sends one push per item to every caregiver phone of that household. Never
 * throws: the event is already saved by the time this runs, so a phone that
 * cannot be reached must not fail the request that produced it. The caregiver
 * still sees everything on the review screen.
 *
 * Returns how many pushes were delivered.
 */
export async function sendItems(householdId: string, items: PushItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const vapid = vapidConfig();
  if (!vapid) return 0;

  const subs = await listSubscriptions(householdId);
  if (subs.length === 0) return 0;

  if (!configured) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    configured = true;
  }

  let delivered = 0;
  for (const sub of subs) {
    for (const item of items) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(toPayload(item)));
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404 and 410 mean the browser is gone for good. Anything else is transient.
        if (status === 404 || status === 410) await deleteSubscription(householdId, sub.endpoint);
        else console.error("push failed", status, (err as Error).message);
      }
    }
  }
  return delivered;
}

/** One alert per thing that just happened, from the events that were saved. */
export async function notifyCaregiver(householdId: string, events: QuidaEvent[]): Promise<number> {
  try {
    return await sendItems(householdId, itemsForEvents(events));
  } catch (err) {
    console.error("caregiver push skipped", (err as Error).message);
    return 0;
  }
}
