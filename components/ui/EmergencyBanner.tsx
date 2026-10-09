import { FENCE_COPY } from "@/lib/fence/copy";

/** Shown above everything when the Fence detects an emergency. Fixed copy, call link. */
export function EmergencyBanner({ className = "" }: { className?: string }) {
  return (
    <div
      role="alert"
      className={`sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-danger px-4 py-4 text-white ${className}`}
    >
      <p className="text-2xl font-bold">{FENCE_COPY.emergency}</p>
      <a
        href="tel:911"
        className="rounded-xl border-2 border-white bg-white px-5 py-3 text-xl font-bold text-danger"
      >
        Llamar al 911
      </a>
    </div>
  );
}
