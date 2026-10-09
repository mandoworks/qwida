const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today in Puerto Rico as YYYY-MM-DD, whatever the server time zone is. */
export function todayPR(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(now);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** "7 de enero" from "2027-01-07". */
export function formatDia(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

/** A referido is valid for 90 days from the day it was issued. */
export const REFERIDO_DAYS = 90;

export function referidoExpiresOn(issueDate: string): string | null {
  return isIsoDate(issueDate) ? addDays(issueDate, REFERIDO_DAYS) : null;
}
