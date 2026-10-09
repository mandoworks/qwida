"use client";

import { useSyncExternalStore } from "react";

/**
 * One clock for the whole family member side, shared by every screen that shows a
 * relative time or today's date.
 *
 * Next.js prerenders with `cacheComponents`, so `new Date()` during render is
 * an unstable value: the prerendered HTML would carry one date and the browser
 * another. The server snapshot is `null` and the placeholder renders until the
 * component has mounted, so no date is ever read while rendering on the server.
 * Nothing on the patient side uses this hook.
 */

const TICK_MS = 30_000;

let now: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function start() {
  now = Date.now();
  if (timer) return;
  timer = setInterval(() => {
    now = Date.now();
    for (const listener of listeners) listener();
  }, TICK_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  now = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => now;
const getServerSnapshot = () => null;

/** Milliseconds since the epoch, or `null` until the component has mounted. */
export function useClock(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Forces a re-read of the clock. For "Intentar otra vez" buttons. */
export function useClockNow(): () => void {
  return () => {
    now = Date.now();
    for (const listener of listeners) listener();
  };
}
