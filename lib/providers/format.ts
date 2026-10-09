import { formatDia, isIsoDate } from "@/lib/photo/dates";

/**
 * ORCPS sends names and certifications in capitals with no accents. Title case
 * makes them readable without inventing letters the registry did not send.
 */
export function readable(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

/** "9 de octubre de 2026" from an ISO timestamp. Falls back to the raw string if it is not a date. */
export function formatConsulted(iso: string): string {
  const date = iso.slice(0, 10);
  return isIsoDate(date) ? `${formatDia(date)} de ${date.slice(0, 4)}` : iso;
}
