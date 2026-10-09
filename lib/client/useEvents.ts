"use client";

import { useEffect, useState } from "react";
import type { QuidaEvent } from "@/lib/store/types";

const POLL_MS = 2000;

/**
 * Shared polling hook for both sides. Keeps a merged list of events for the
 * demo household, fetching only changes every 2 seconds, and starts over
 * when the demo is reset.
 */
export function useEvents(householdId?: string) {
  const [events, setEvents] = useState<QuidaEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cursor: string | null = null;
    let resetAt: string | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const params = new URLSearchParams();
        if (householdId) params.set("householdId", householdId);
        if (cursor) params.set("since", cursor);
        const res = await fetch(`/api/events?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { events: QuidaEvent[]; cursor: string | null; resetAt: string } = await res.json();

        if (resetAt !== null && data.resetAt !== resetAt) {
          // Demo was reset elsewhere: drop everything and refetch in full.
          resetAt = data.resetAt;
          cursor = null;
          setEvents([]);
        } else {
          resetAt = data.resetAt;
          cursor = data.cursor;
          if (data.events.length) {
            setEvents((prev) => {
              const byId = new Map(prev.map((e) => [e.id, e]));
              for (const e of data.events) byId.set(e.id, e);
              return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            });
          }
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [householdId]);

  return { events, error };
}
