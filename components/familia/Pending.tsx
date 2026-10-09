"use client";

import type { ReactNode } from "react";

/**
 * Rendered until the family member side has mounted in the browser. Keeps the
 * prerender stable: nothing inside reads the clock or the device locale.
 */
export function Pending({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <p className="text-c-meta text-ink-mute">{label}</p>
      <div className="opacity-60">{children}</div>
    </div>
  );
}
