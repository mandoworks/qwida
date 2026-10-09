"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGED = "quida-local-change";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGED, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGED, cb);
  };
}

/**
 * A small per device value kept in localStorage. `undefined` while rendering
 * on the server (so nothing flashes), `null` when unset or when storage is
 * blocked. Storage is a convenience here, never the source of truth.
 */
export function useLocalValue(key: string): [string | null | undefined, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => undefined,
  );
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {
        // Private window or blocked storage: the hint just comes back next time.
      }
      window.dispatchEvent(new Event(CHANGED));
    },
    [key],
  );
  return [value, set];
}
