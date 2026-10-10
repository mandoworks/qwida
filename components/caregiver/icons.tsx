/**
 * Inline line icons, verbatim paths from `~/Git Repos/qwida-warroom/ui/DESIGN.md`
 * section 3.4, so a missing drawing still reads right (3.5).
 *
 * TODO(W1): when `components/ui/icons.tsx` and `components/ui/Art.tsx` land
 * (DESIGN.md 3.3 and 3.4, both W1), delete this file and import from there.
 * The paths are identical, so it is a one line change per import.
 */

type IconProps = { size?: number; className?: string };

const base = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export function ChevronLeft({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function ChevronRight({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function Copy({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

export function Message({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

export function Bell({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function Seal({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}

export function Calendar({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function Clock({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function Alert({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M10.3 4.3 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v5" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

export function Download({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3v12" />
      <path d="M7.5 11 12 15.5 16.5 11" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function Pencil({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14 6l3 3" />
    </svg>
  );
}

export function Plus({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function X({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function Eye({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Search({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function Globe({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </svg>
  );
}

export function Pill({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M10.5 20.5a5 5 0 0 1-7-7l7-7a5 5 0 0 1 7 7z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  );
}

/**
 * Fallback for `Art slot=avatar-carmen` (3.2) until Yari's drawing lands.
 * Line art, no fill, ink coloured by `currentColor`.
 */
export function AvatarCarmen({ size = 72, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="9" r="4.5" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function Phone({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
