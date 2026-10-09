import { FENCE_COPY } from "@/lib/fence/copy";

/** Fixed Fence copy. Text is not a prop on purpose: it must never change per screen. */
export function FenceNotice({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-xl border-2 border-line bg-surface px-4 py-3 font-bold text-ink ${className}`}
    >
      {FENCE_COPY.medChange}
    </p>
  );
}
