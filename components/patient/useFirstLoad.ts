"use client";

import { useEffect, useState } from "react";

/** A poll plus margin on a slow venue network. After this the empty state is honest. */
const GIVE_UP_MS = 4000;

/**
 * `useEvents` has no "first poll done" flag, so a screen would flash its empty
 * state before any data arrives. Loaded once events show up, an error shows up,
 * or the grace period passes.
 */
export function useFirstLoad(hasEvents: boolean, error: string | null): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, []);
  return hasEvents || error !== null || waited;
}
