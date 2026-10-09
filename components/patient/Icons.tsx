import type { ReactNode } from "react";

/**
 * Simple line icons. Each is a named slot: Heather and Yari's drawings replace
 * the paths here without touching any screen.
 */
function Svg({ children, size = 48 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const MicIcon = () => (
  <Svg>
    <rect x="17" y="5" width="14" height="25" rx="7" />
    <path d="M10 24a14 14 0 0 0 28 0M24 38v6M17 44h14" />
  </Svg>
);

export const CameraIcon = () => (
  <Svg>
    <path d="M6 16h9l3-5h12l3 5h9v24H6z" />
    <circle cx="24" cy="27" r="7" />
  </Svg>
);

export const CardIcon = () => (
  <Svg>
    <rect x="6" y="8" width="36" height="32" rx="4" />
    <path d="M6 18h36M14 27h20M14 34h12" />
  </Svg>
);

export const VoiceIcon = () => (
  <Svg>
    <path d="M6 10h36v22H24l-9 8v-8H6z" />
    <path d="M15 21h18" />
  </Svg>
);

export const SpeakerIcon = () => (
  <Svg size={36}>
    <path d="M6 18h8l10-8v28l-10-8H6zM32 16a11 11 0 0 1 0 16M38 10a19 19 0 0 1 0 28" />
  </Svg>
);

export const PillIcon = () => (
  <Svg size={32}>
    <rect x="4" y="15" width="40" height="18" rx="9" transform="rotate(-35 24 24)" />
    <path d="M18 30l12-12" />
  </Svg>
);

export const SlotIcon = ({ slot }: { slot: "mañana" | "mediodía" | "tarde" | "noche" }) => (
  <Svg size={44}>
    {slot === "mañana" && <path d="M4 34h40M12 34a12 12 0 0 1 24 0M24 8v6M9 15l4 4M39 15l-4 4" />}
    {slot === "mediodía" && (
      <>
        <circle cx="24" cy="24" r="8" />
        <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" />
      </>
    )}
    {slot === "tarde" && <path d="M4 38h40M12 38a12 12 0 0 1 24 0M24 14v6M9 21l4 4M39 21l-4 4M18 8l6 6 6-6" />}
    {slot === "noche" && <path d="M36 30A16 16 0 0 1 18 8a16 16 0 1 0 18 22z" />}
  </Svg>
);
