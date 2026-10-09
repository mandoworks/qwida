import { z } from "zod";

/**
 * Payload of a CONFIRMADO `weekcard` event. W4 (patient side) reads exactly
 * this shape in `components/patient/logic.ts`; do not change it here without
 * changing that file too.
 */
const Hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

export const CardItem = z.object({
  day: z.string().min(1),
  time: z.string().optional(),
  text: z.string().min(1),
  icon: z.string().max(4).optional(),
});

export const CardTheme = z.object({ primary: Hex, accent: Hex });

export const WeekCard = z.object({
  title: z.string().min(1),
  theme: CardTheme.optional(),
  items: z.array(CardItem),
  questionsForDoctor: z.array(z.string()),
});

export type CardItem = z.infer<typeof CardItem>;
export type CardTheme = z.infer<typeof CardTheme>;
export type WeekCard = z.infer<typeof WeekCard>;

/** Default title when nothing else is known. */
export const DEFAULT_CARD_TITLE = "Mi tarjeta de la semana";

/**
 * Color presets only: no team names, no logos. Every pair was picked so white
 * ink clears AAA (7:1) on both colors, which is what W4 checks before using a
 * theme instead of the default tokens.
 */
export const CARD_THEMES = [
  { id: "azul", primary: "#0A2E6B", accent: "#17408C" },
  { id: "rojo", primary: "#6B1414", accent: "#8C1D1D" },
  { id: "verde", primary: "#14532D", accent: "#166534" },
] as const;

export type ThemeId = (typeof CARD_THEMES)[number]["id"];

export function themeById(id: string | null | undefined): CardTheme | undefined {
  const found = CARD_THEMES.find((t) => t.id === id);
  return found ? { primary: found.primary, accent: found.accent } : undefined;
}

/** Placeholder symbols until the hand drawn icons arrive. Plain glyphs, never emoji. */
export const CARD_ICONS = ["+", "◆", "▤", "➤", "?"] as const;
