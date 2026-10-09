"use client";

import { useState, type ReactElement } from "react";

type Fallback = (props: { size: number }) => ReactElement;

type ArtProps = {
  /** File name in `public/art/` without the `.png`, for example `icon-hablar`. */
  slot: string;
  /** Spanish alt text. Use "" when the text next to the drawing already says it. */
  alt: string;
  /** On screen width in px. `height` defaults to the same value (square slots). */
  width: number;
  height?: number;
  /** Line icon shown when the PNG does not exist. Without it the slot simply disappears. */
  fallback?: Fallback;
  className?: string;
};

/**
 * Hand drawn art slot (`ui/ASSETS.md`). PNG only. A missing file never shows a broken image:
 * the line icon takes its place, or nothing for slots that are optional.
 */
export function Art({ slot, alt, width, height = width, fallback: Fallback, className = "" }: ArtProps) {
  const [missing, setMissing] = useState<string | null>(null);
  if (missing === slot) return Fallback ? <Fallback size={width} /> : null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static drawings, a plain img lets onError fall back
    <img
      // The error can fire before hydration attaches onError, so the ref also checks the finished load.
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) setMissing(slot);
      }}
      src={`/art/${slot}.png`}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      onError={() => setMissing(slot)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
