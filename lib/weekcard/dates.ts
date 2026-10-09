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

/** First ten characters of a datetime, the YYYY-MM-DD the date helpers want. */
export function isoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
