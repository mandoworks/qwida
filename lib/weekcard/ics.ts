import type { QuidaEvent } from "@/lib/store/types";

const CRLF = "\r\n";
const DEFAULT_MINUTES = 60;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** ICS escaping: backslash, semicolon, comma, and newlines. */
export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 folds content lines longer than 75 octets, continuing with a space. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < line.length) {
    let end = Math.min(line.length, start + limit);
    // Do not cut a character in half when a multi byte character straddles the limit.
    while (end > start && new TextEncoder().encode(line.slice(start, end)).length > limit) end -= 1;
    out.push((out.length ? " " : "") + line.slice(start, end));
    start = end;
    limit = 74;
  }
  return out.join(CRLF);
}

/** 20261018T140000Z. */
function toUtc(iso: string): string | null {
  const hasTime = /T\d{2}:\d{2}/.test(iso);
  const d = new Date(hasTime ? iso : `${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** DTSTART or DTEND, a whole day value when the source carries no time. */
function stamp(iso: string): string {
  if (!/T\d{2}:\d{2}/.test(iso)) return `;VALUE=DATE:${iso.slice(0, 10).replace(/-/g, "")}`;
  return `:${toUtc(iso) ?? `VALUE=DATE:${iso.slice(0, 10).replace(/-/g, "")}`}`;
}

function endStamp(iso: string, minutes: number): string {
  if (!/T\d{2}:\d{2}/.test(iso)) {
    const next = new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    return `;VALUE=DATE:${next.replace(/-/g, "")}`;
  }
  return `:${toUtc(new Date(Date.parse(iso) + minutes * 60_000).toISOString()) ?? "19700101T000000Z"}`;
}

export type IcsOptions = { now: string; minutes?: number; calendarName?: string };

/**
 * Real .ics text for the confirmed appointments only. Synthetic demo data, so
 * the calendar name and the description say so. Pure: same events in, same text
 * out, which is what the test checks.
 */
export function buildIcs(events: QuidaEvent[], options: IcsOptions): string {
  const { now, minutes = DEFAULT_MINUTES, calendarName = "Qwida (datos sintéticos)" } = options;
  const appointments = events.filter((e) => e.kind === "appointment" && e.status === "CONFIRMADO" && str(e.payload.date));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Qwida//Familia//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  for (const e of appointments) {
    const iso = str(e.payload.date)!;
    const specialty = str(e.payload.specialty);
    const doctor = str(e.payload.doctor);
    const place = str(e.payload.place);
    const summary = [`Cita de ${specialty ?? "seguimiento"}`, doctor].filter(Boolean).join(" con ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@quida.local`,
      `DTSTAMP:${toUtc(now) ?? "19700101T000000Z"}`,
      `DTSTART${stamp(iso)}`,
      `DTEND${endStamp(iso, minutes)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      ...(place ? [`LOCATION:${escapeIcs(place)}`] : []),
      "DESCRIPTION:Datos sintéticos de demostración. Qwida no da diagnósticos ni cambia medicamentos.",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

export const ICS_FILENAME = "quida-citas.ics";
