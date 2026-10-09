import { describe, expect, it } from "vitest";
import { HOUSEHOLD_ID } from "@/lib/seed";
import type { QuidaEvent } from "@/lib/store/types";
import { buildDigest, changesSince, lowConfidence, pendingItems, upcoming } from "./digest";
import { buildIcs, escapeIcs, foldLine } from "./ics";
import { buildNudges, whatsappUrl } from "./nudges";
import { filterRows, timelineRows } from "./timeline";
import { format, STRINGS, t, type StringKey } from "./strings";

const TODAY = "2026-10-09";

let counter = 0;

function event(partial: Partial<QuidaEvent> & { kind: QuidaEvent["kind"] }): QuidaEvent {
  counter += 1;
  const createdAt = partial.createdAt ?? `2026-10-09T1${counter}:00:00.000Z`;
  return {
    id: partial.id ?? `evt-${counter}`,
    householdId: HOUSEHOLD_ID,
    kind: partial.kind,
    status: partial.status ?? "BORRADOR",
    payload: partial.payload ?? {},
    source: partial.source ?? "caregiver",
    confidence: partial.confidence ?? null,
    createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
  };
}

const appointment = event({
  kind: "appointment",
  status: "CONFIRMADO",
  payload: { specialty: "cardiología", doctor: "Dra. Isabel Montalvo (ficticia)", place: "Centro Cardiovascular de Utuado (ficticio)", date: "2026-10-10T14:00:00.000Z" },
});

const med = event({
  kind: "med_schedule",
  status: "CONFIRMADO",
  payload: { drug: "metformina", dose: "500 mg", slots: ["mañana", "noche"], refill: { runs_out_on: "2026-10-14" } },
});

const referido = event({
  kind: "referido",
  status: "CONFIRMADO",
  payload: { specialty: "endocrinología", expires_on: "2026-10-20" },
});

const fence = event({
  kind: "fence",
  status: "POR_CONFIRMAR",
  source: "system",
  payload: { emergency: true, context: "visit", copy: ["Si es una emergencia, llame al 911."] },
});

describe("changesSince", () => {
  it("is empty on the first visit, when nothing has been seen yet", () => {
    expect(changesSince([appointment], null)).toEqual([]);
  });

  it("only reports events touched after the last look", () => {
    const older = event({ kind: "visit", updatedAt: "2026-10-08T10:00:00.000Z" });
    const newer = event({ kind: "rx_label", updatedAt: "2026-10-09T10:00:00.000Z" });
    const changes = changesSince([older, newer], "2026-10-09T09:00:00.000Z");
    expect(changes.map((c) => c.kind)).toEqual(["photo"]);
  });

  it("counts a status change as a change", () => {
    const confirmed = event({ kind: "visit", updatedAt: "2026-10-09T10:00:00.000Z" });
    expect(changesSince([confirmed], "2026-10-09T09:00:00.000Z")).toHaveLength(1);
  });
});

describe("upcoming", () => {
  it("sorts the next appointment, refill and referral by days", () => {
    const things = upcoming([appointment, med, referido], TODAY);
    expect(things.map((n) => [n.kind, n.days])).toEqual([
      ["cita", 1],
      ["recarga", 5],
      ["referido", 11],
    ]);
  });

  it("ignores appointments in the past and unconfirmed events", () => {
    const past = event({ kind: "appointment", payload: { date: "2026-09-01T10:00:00.000Z" } });
    const draft = event({ kind: "appointment", payload: { specialty: "ojos", date: "2026-10-10T10:00:00.000Z" } });
    expect(upcoming([past, draft], TODAY)).toEqual([]);
  });
});

describe("pendingItems", () => {
  it("lists what still needs a person, and no nudges", () => {
    const nudge = event({ kind: "nudge", payload: { text: "Cuando recoja la receta..." } });
    expect(pendingItems([appointment, fence, nudge]).map((p) => p.kind)).toEqual(["fence"]);
  });
});

describe("buildDigest", () => {
  it("puts the Fence alert first and suggests reviewing it", () => {
    const digest = buildDigest([fence], { seenAt: "2026-10-09T09:00:00.000Z", today: TODAY });
    expect(digest.fence).toMatchObject({ id: fence.id, emergency: true });
    expect(digest.action).toEqual({ href: "/cuidador/revisar", key: "fence" });
    expect(digest.quiet).toBe(false);
  });

  it("suggests one single action at a time", () => {
    expect(buildDigest([event({ kind: "visit" })], { seenAt: null, today: TODAY }).action).toEqual({
      href: "/cuidador/revisar",
      key: "review",
    });
    expect(buildDigest([appointment], { seenAt: null, today: TODAY }).action).toEqual({
      href: "/cuidador/tarjeta",
      key: "weekcard",
    });
    const withCard = [
      appointment,
      event({ kind: "weekcard", status: "CONFIRMADO", updatedAt: "2026-10-09T08:00:00.000Z", payload: { items: [] } }),
    ];
    expect(buildDigest(withCard, { seenAt: null, today: TODAY }).action).toEqual({
      href: "/cuidador/tiempo",
      key: "timeline",
    });
  });

  it("goes quiet when everything is confirmed and nothing changed", () => {
    const card = event({ kind: "weekcard", status: "CONFIRMADO", updatedAt: "2026-10-09T08:00:00.000Z", payload: { items: [] } });
    const digest = buildDigest([appointment, card], { seenAt: "2026-10-09T23:00:00.000Z", today: TODAY });
    expect(digest.quiet).toBe(true);
    expect(digest.changes).toEqual([]);
  });

  it("keeps the digest and the next things together", () => {
    const digest = buildDigest([appointment, med, referido, fence], { seenAt: null, today: TODAY });
    expect(digest.next).toHaveLength(3);
    expect(digest.pending).toHaveLength(1);
  });
});

describe("lowConfidence", () => {
  it("flags anything the model was unsure about", () => {
    expect(lowConfidence(event({ kind: "rx_label", confidence: 0.42 }))).toBe(true);
    expect(lowConfidence(event({ kind: "rx_label", confidence: 0.9 }))).toBe(false);
    expect(lowConfidence(event({ kind: "rx_label", confidence: null }))).toBe(false);
  });
});

describe("timeline", () => {
  const events = [
    appointment,
    med,
    referido,
    event({ kind: "rx_label", payload: { fields: { drug: { value: "atorvastatina" }, strength: { value: "20 mg" } } } }),
    event({ kind: "visit", payload: { prescriptions: [{}], questions_back: ["?"] } }),
    fence,
    event({ kind: "voice_note", payload: { text: "Me siento bien hoy." } }),
  ];

  it("lists everything newest first and groups by type", () => {
    const rows = timelineRows(events);
    expect(rows.map((r) => r.group).sort()).toEqual(["alerta", "cita", "nota", "nota", "receta", "receta", "referido"]);
    expect(rows[0].at >= rows.at(-1)!.at).toBe(true);
  });

  it("filters by type", () => {
    const rows = timelineRows(events);
    expect(filterRows(rows, "cita", "").map((r) => r.title)).toEqual(["Cita de cardiología"]);
    expect(filterRows(rows, "alerta", "").every((r) => r.group === "alerta")).toBe(true);
    expect(filterRows(rows, "all", "").length).toBe(rows.length);
  });

  it("filters by specialty text, accents and case insensitive", () => {
    const rows = timelineRows(events);
    expect(filterRows(rows, "all", "cardiología").map((r) => r.id)).toEqual([appointment.id]);
    expect(filterRows(rows, "all", "CARDIOLOGIA").map((r) => r.id)).toEqual([appointment.id]);
    expect(filterRows(rows, "all", "endocrinologia").map((r) => r.id)).toEqual([referido.id]);
    expect(filterRows(rows, "all", "oncología")).toEqual([]);
  });

  it("pulls the specialty out of a label photo", () => {
    const referred = event({ kind: "rx_label", payload: { fields: { specialty: { value: "nefro-logía" } } } });
    const rows = timelineRows([referred]);
    expect(filterRows(rows, "all", "nefro").map((r) => r.id)).toEqual([referred.id]);
  });
});

describe("nudges", () => {
  it("asks for the pharmacy label after a handwritten prescription", () => {
    const handwritten = event({ kind: "rx_handwritten", createdAt: "2026-10-09T10:00:00.000Z" });
    expect(buildNudges([handwritten], TODAY).map((n) => n.kind)).toEqual(["label_rescan"]);
  });

  it("stops asking once the label arrives", () => {
    const handwritten = event({ kind: "rx_handwritten", createdAt: "2026-10-08T10:00:00.000Z" });
    const label = event({ kind: "rx_label", createdAt: "2026-10-09T10:00:00.000Z", status: "CONFIRMADO" });
    expect(buildNudges([handwritten, label], TODAY).map((n) => n.kind)).toEqual([]);
  });

  it("reminds about the refill, the referral and tomorrow's appointment", () => {
    const tomorrow = event({
      kind: "appointment",
      status: "CONFIRMADO",
      payload: { specialty: "cardiología", place: "Centro Cardiovascular de Utuado", date: "2026-10-10T09:00:00.000Z" },
    });
    const kinds = buildNudges([med, referido, tomorrow], TODAY).map((n) => n.kind);
    expect(kinds).toEqual(["refill", "referido", "appointment"]);
  });

  it("says nothing about a refill that is far away", () => {
    const far = event({ kind: "med_schedule", status: "CONFIRMADO", payload: { drug: "metformina", refill: { runs_out_on: "2026-12-01" } } });
    expect(buildNudges([far], TODAY)).toEqual([]);
  });

  it("never sends medication advice in the text", () => {
    for (const nudge of buildNudges([med, referido], TODAY)) {
      expect(nudge.message).not.toMatch(/tome más|deje de|suba la dosis/i);
    }
  });

  it("opens WhatsApp with the text encoded, no API", () => {
    const url = whatsappUrl("Mami, le quedan 5 días.");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.replace("https://wa.me/?text=", ""))).toBe("Mami, le quedan 5 días.");
  });
});

describe("ics", () => {
  it("escapes the characters that break a content line", () => {
    expect(escapeIcs("Sala 2; cardiología, 3.º\npiso")).toBe("Sala 2\\; cardiología\\, 3.º\\npiso");
  });

  it("folds a long line at 75 octets", () => {
    const folded = foldLine(`DESCRIPTION:${"a".repeat(200)}`);
    for (const line of folded.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.split("\r\n")[1].startsWith(" ")).toBe(true);
  });

  it("writes one VEVENT per confirmed appointment with real timestamps", () => {
    const ics = buildIcs([appointment, med], { now: "2026-10-09T12:00:00.000Z" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain(`UID:${appointment.id}@quida.local`);
    expect(ics).toContain("DTSTART:20261010T140000Z");
    expect(ics).toContain("DTEND:20261010T150000Z");
    expect(ics).toContain("SUMMARY:Cita de cardiología con Dra. Isabel Montalvo (ficticia)");
    expect(ics).toContain("LOCATION:Centro Cardiovascular de Utuado (ficticio)");
    expect(ics).toContain("sintéticos");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("keeps a date only appointment as a whole day event", () => {
    const allDay = event({ kind: "appointment", status: "CONFIRMADO", payload: { specialty: "ojos", date: "2026-10-15" } });
    const ics = buildIcs([allDay], { now: "2026-10-09T12:00:00.000Z" });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261015");
    expect(ics).toContain("DTEND;VALUE=DATE:20261016");
  });

  it("skips BORRADOR appointments", () => {
    const draft = event({ kind: "appointment", payload: { date: "2026-10-10T14:00:00.000Z" } });
    expect(buildIcs([draft], { now: "2026-10-09T12:00:00.000Z" })).not.toContain("BEGIN:VEVENT");
  });
});

describe("strings", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.es).sort());
  });

  it("interpolates values and leaves unknown placeholders visible", () => {
    expect(format("Quedan {days} días de {drug}", { days: 5 })).toBe("Quedan 5 días de {drug}");
  });

  it("translates a known key and falls back to Spanish", () => {
    expect(t("en", "nav.tiempo")).toBe("Timeline");
    expect(t("es", "digest.action.review", { n: 3 })).toBe("Revisar 3 pendientes");
    expect(t("en", "digest.action.review", { n: 3 })).toBe("Review 3 pending items");
  });

  it("keeps the caregiver copy free of em dashes and clause hyphens", () => {
    for (const lang of ["es", "en"] as const) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        expect(`${key}: ${value}`).not.toMatch(/[—–]/);
      }
    }
  });

  it("only exposes keys both languages declare", () => {
    const key: StringKey = "nav.ajustes";
    expect(t("es", key)).toBe("Ajustes");
  });
});
