import type { ReactNode } from "react";

/** Simple line icons until the hand drawn ones arrive. Slot names match lib/photo/trust SLOTS. */
function Svg({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function SlotIcon({ slot, className }: { slot: string; className?: string }) {
  switch (slot) {
    case "mañana":
      return (
        <Svg className={className}>
          <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M5.6 10.6l2 2M18.4 10.6l-2 2" />
        </Svg>
      );
    case "mediodía":
      return (
        <Svg className={className}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </Svg>
      );
    case "tarde":
      return (
        <Svg className={className}>
          <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 9V6M9.5 7.5L12 10l2.5-2.5" />
        </Svg>
      );
    default:
      return (
        <Svg className={className}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </Svg>
      );
  }
}

/** Slot for the pill drawing. */
export function PillIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-30 12 12)" />
      <path d="M9.2 7.2l5.6 9.6" />
    </Svg>
  );
}
