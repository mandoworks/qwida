import { FENCE_COPY } from "@/lib/fence/copy";
import { Art } from "./Art";

/**
 * Fixed Fence copy. Text is not a prop on purpose: it must never change per screen.
 * `art` adds the "cerca" drawing beside the text; it is off by default so compact uses stay compact.
 */
export function FenceNotice({ className = "", art = false }: { className?: string; art?: boolean }) {
  return (
    <p
      role="note"
      className={`rounded-xl border-2 border-line bg-surface px-4 py-3 font-bold text-ink ${
        art ? "flex items-center gap-4" : ""
      } ${className}`}
    >
      {art && <Art slot="cerca" alt="" width={96} />}
      {FENCE_COPY.medChange}
    </p>
  );
}
