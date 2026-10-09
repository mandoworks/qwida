import { formatDia } from "@/lib/photo/dates";

/** Sunday first, the way Puerto Rican calendars are printed. */
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "jueves 15 de octubre" from a YYYY-MM-DD date, in UTC so the day never slips. */
export function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (isNaN(d.getTime())) return isoDate;
  return `${WEEKDAYS[d.getUTCDay()]} ${formatDia(isoDate)}`;
}

/** "10:00" from an ISO datetime, or null when the event carries no time. */
export function timeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * "10:00 a. m." from an ISO datetime. Read straight out of the string, so the
 * label is the same in the browser and in a test: no clock, no time zone, and
 * no `new Date()` while rendering.
 */
export function timeLabel12(iso: string | null | undefined): string | null {
  const hhmm = timeLabel(iso);
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m < 10 ? `0${m}` : m} ${suffix}`;
}

/**
 * "sábado 18 de octubre, 10:00 a. m." for a datetime, or the day alone when the
 * event carries no time. Pure: the same string comes out every render, which is
 * what the timeline needs now that Next.js prerenders these pages.
 */
export function whenLabel(iso: string | null | undefined): string | null {
  const day = isoDate(iso);
  if (!day) return null;
  const label = dayLabel(day);
  const time = timeLabel12(iso);
  return time ? `${label}, ${time}` : label;
}

/** First ten characters of a datetime, the YYYY-MM-DD the date helpers want. */
export function isoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
