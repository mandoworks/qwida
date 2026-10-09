import type { Lang } from "./strings";

export type RelativeKey = "time.now" | "time.min" | "time.hour" | "time.day";

/**
 * "hace 5 min" without building the sentence here: the key goes to the
 * dictionary so the caregiver side reads in Spanish or English.
 */
export function relativeTime(iso: string, now: Date): { key: RelativeKey; n: number } {
  const minutes = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (!isFinite(minutes) || minutes < 1) return { key: "time.now", n: 0 };
  if (minutes < 60) return { key: "time.min", n: minutes };
  if (minutes < 60 * 24) return { key: "time.hour", n: Math.round(minutes / 60) };
  return { key: "time.day", n: Math.round(minutes / (60 * 24)) };
}

const LOCALE: Record<Lang, string> = { es: "es-PR", en: "en-US" };

/** "viernes 9 de octubre, 2:15 p. m." Short enough for a list row. */
export function longDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** Just the hour, "2:15 p. m.", for a dense timeline row. */
export function clockTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: "numeric", minute: "2-digit" }).format(d);
}

export function todayLong(lang: Lang, now: Date): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "long", day: "numeric", month: "long" }).format(now);
}
