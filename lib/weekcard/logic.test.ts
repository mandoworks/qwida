import { describe, expect, it } from "vitest";
import { HOUSEHOLD_ID } from "@/lib/seed";
import type { QuidaEvent } from "@/lib/store/types";
import { timeLabel12, whenLabel } from "./dates";
import { buildDigest, changesSince, lastSignal, lowConfidence, pendingItems, refills, upcoming, watchlist } from "./digest";
import { buildIcs, escapeIcs, foldLine } from "./ics";
import { canSend, mergeEvent, sendReducer } from "./send";
import { buildNudges, whatsappUrl } from "./nudges";
import { filterRows, groupByDay, timelineRows, sourceKey } from "./timeline";
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

  it("never queues the editor autosave, which is not care history", () => {
    const draft = event({ kind: "weekcard", payload: { items: [] } });
    const sent = event({ kind: "weekcard", status: "CONFIRMADO", payload: { items: [] } });
    expect(pendingItems([draft, sent])).toEqual([]);
  });
});

describe("buildDigest", () => {
  it("puts the Fence alert first and suggests reviewing it", () => {
    const digest = buildDigest([fence], { seenAt: "2026-10-09T09:00:00.000Z", today: TODAY });
    expect(digest.fence).toMatchObject({ id: fence.id, emergency: true });
    expect(digest.action).toEqual({ href: "/familia/revisar", key: "fence" });
    expect(digest.quiet).toBe(false);
  });

  it("suggests one single action at a time", () => {
    expect(buildDigest([event({ kind: "visit" })], { seenAt: null, today: TODAY }).action).toEqual({
      href: "/familia/revisar",
      key: "review",
    });
    expect(buildDigest([appointment], { seenAt: null, today: TODAY }).action).toEqual({
      href: "/familia/tarjeta",
      key: "weekcard",
    });
    const withCard = [
      appointment,
      event({ kind: "weekcard", status: "CONFIRMADO", updatedAt: "2026-10-09T08:00:00.000Z", payload: { items: [] } }),
    ];
    expect(buildDigest(withCard, { seenAt: null, today: TODAY }).action).toEqual({
      href: "/familia/linea-de-tiempo",
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

describe("refills", () => {
  it("keeps the confirmed medicines inside the reminder window, soonest first", () => {
    const soon = event({ kind: "med_schedule", status: "CONFIRMADO", payload: { drug: "amlodipino", refill: { runs_out_on: "2026-10-12" } } });
    const later = event({ kind: "med_schedule", status: "CONFIRMADO", payload: { drug: "metformina", refill: { runs_out_on: "2026-10-20" } } });
    const far = event({ kind: "med_schedule", status: "CONFIRMADO", payload: { drug: "omeprazol", refill: { runs_out_on: "2026-12-01" } } });
    expect(refills([later, far, soon], TODAY)).toEqual([
      { id: soon.id, drug: "amlodipino", days: 3, runs_out_on: "2026-10-12" },
      { id: later.id, drug: "metformina", days: 11, runs_out_on: "2026-10-20" },
    ]);
  });

  it("ignores a BORRADOR schedule", () => {
    const draft = event({ kind: "med_schedule", payload: { drug: "x", refill: { runs_out_on: "2026-10-10" } } });
    expect(refills([draft], TODAY)).toEqual([]);
  });
});

describe("watchlist", () => {
  it("only referrals inside 30 days, expired ones included", () => {
    const soon = event({ kind: "referido", status: "CONFIRMADO", payload: { specialty: "cardiología", expires_on: "2026-10-15" } });
    const gone = event({ kind: "referido", status: "CONFIRMADO", payload: { specialty: "neurología", expires_on: "2026-09-01" } });
    const far = event({ kind: "referido", status: "CONFIRMADO", payload: { specialty: "ojos", expires_on: "2027-01-01" } });
    expect(watchlist([soon, far, gone], TODAY).map((r) => [r.specialty, r.days])).toEqual([
      ["neurología", -38],
      ["cardiología", 6],
    ]);
  });
});

describe("lastSignal", () => {
  it("reports the newest real signal and where it came from", () => {
    const voice = event({ kind: "voice_note", createdAt: "2026-10-09T15:00:00.000Z", source: "voice" });
    const photo = event({ kind: "rx_label", createdAt: "2026-10-09T09:00:00.000Z", source: "photo" });
    const nudge = event({ kind: "nudge", createdAt: "2026-10-09T23:00:00.000Z" });
    const card = event({ kind: "weekcard", status: "CONFIRMADO", createdAt: "2026-10-09T23:30:00.000Z" });
    expect(lastSignal([photo, voice, nudge, card])).toEqual({ at: voice.createdAt, source: "voice" });
    expect(lastSignal([photo, nudge, card])).toEqual({ at: photo.createdAt, source: "photo" });
    expect(sourceKey(photo)).toBe("photo");
    expect(sourceKey(event({ kind: "visit", source: "voice" }))).toBe("visit");
    expect(lastSignal([])).toBeNull();
  });
});

describe("groupByDay", () => {
  it("groups newest day first and flags today and yesterday", () => {
    const rows = timelineRows([
      event({ kind: "voice_note", createdAt: "2026-10-08T15:00:00.000Z" }),
      event({ kind: "visit", createdAt: "2026-10-09T15:00:00.000Z" }),
      event({ kind: "rx_label", createdAt: "2026-10-09T09:00:00.000Z" }),
    ]);
    const groups = groupByDay(rows, "2026-10-09");
    expect(groups.map((g) => [g.date, g.today, g.yesterday, g.rows.length])).toEqual([
      ["2026-10-09", true, false, 2],
      ["2026-10-08", false, true, 1],
    ]);
  });
});

describe("timeline paper trail", () => {
  it("shows who confirmed, when and from which device, from the last confirmation in the history", () => {
    const [row] = timelineRows([
      event({
        kind: "rx_label",
        status: "CONFIRMADO",
        payload: {
          history: [
            { status: "POR_CONFIRMAR", at: "2026-10-09T13:00:00.000Z", by: null, name: null, device: null },
            { status: "CONFIRMADO", at: "2026-10-09T13:41:00.000Z", by: "caregiver", name: "Marisol Rivera", device: "iPhone" },
          ],
        },
      }),
    ]);
    expect(row.confirmed).toEqual({ by: "caregiver", name: "Marisol Rivera", device: "iPhone", at: "2026-10-09T13:41:00.000Z" });
  });

  it("falls back to the stamp on older events, and shows nothing without a person", () => {
    const stamped = event({ kind: "appointment", status: "CONFIRMADO", payload: { confirmedBy: "patient", confirmedAt: "2026-10-09T12:00:00.000Z" } });
    const seeded = event({ kind: "appointment", status: "CONFIRMADO" });
    const draft = event({ kind: "appointment", payload: { confirmedBy: "caregiver", confirmedAt: "2026-10-09T12:00:00.000Z" } });
    const rows = timelineRows([stamped, seeded, draft]);
    expect(rows.find((r) => r.id === stamped.id)?.confirmed).toEqual({ by: "patient", name: null, device: null, at: "2026-10-09T12:00:00.000Z" });
    expect(rows.find((r) => r.id === seeded.id)?.confirmed).toBeNull();
    expect(rows.find((r) => r.id === draft.id)?.confirmed).toBeNull();
  });

  it("shows the recording consent on a visit only when both people said yes", () => {
    const yes = event({ kind: "visit", payload: { consent: { patient: true, doctor: true, at: "2026-10-09T14:00:00.000Z", device: "Android" } } });
    const none = event({ kind: "visit", payload: { consent: null } });
    const rows = timelineRows([yes, none]);
    expect(rows.find((r) => r.id === yes.id)?.consent).toEqual({ at: "2026-10-09T14:00:00.000Z", device: "Android" });
    expect(rows.find((r) => r.id === none.id)?.consent).toBeNull();
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

  it("hides the BORRADOR weekcard autosave but keeps the sent card", () => {
    const draft = event({ kind: "weekcard", payload: { items: [] } });
    const sent = event({ kind: "weekcard", status: "CONFIRMADO", payload: { items: [] } });
    expect(timelineRows([draft, sent]).map((r) => r.id)).toEqual([sent.id]);
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

  it("writes the appointment date in Spanish, never as a raw ISO string", () => {
    const rows = timelineRows([appointment]);
    const date = rows[0]!.facts.find((f) => f.key === "date")!.value;
    expect(date).toBe("sábado 10 de octubre, 2:00 p. m.");
    expect(date).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("keeps the sent card and the reminders out of NOTAS DE VOZ", () => {
    const voice = event({ kind: "voice_note", payload: { text: "Me siento bien." } });
    const recording = event({ kind: "visit", payload: {} });
    const card = event({ kind: "weekcard", status: "CONFIRMADO", payload: { items: [] } });
    const nudge = event({ kind: "nudge", payload: { text: "Recoger la receta." } });
    const rows = timelineRows([voice, recording, card, nudge]);
    expect(filterRows(rows, "nota", "").map((r) => r.id).sort()).toEqual([voice.id, recording.id].sort());
    expect(filterRows(rows, "nota", "").some((r) => r.id === card.id)).toBe(false);
    expect(filterRows(rows, "nota", "").some((r) => r.id === nudge.id)).toBe(false);
    expect(rows).toHaveLength(4);
  });
});

describe("whenLabel", () => {
  it("reads the weekday, the day and the hour off the string", () => {
    expect(whenLabel("2026-10-18T10:00:00.000Z")).toBe("domingo 18 de octubre, 10:00 a. m.");
    expect(whenLabel("2026-10-17T14:30:00.000Z")).toBe("sábado 17 de octubre, 2:30 p. m.");
  });

  it("keeps noon and midnight on the twelve hour clock", () => {
    expect(timeLabel12("2026-10-18T12:00:00.000Z")).toBe("12:00 p. m.");
    expect(timeLabel12("2026-10-18T00:15:00.000Z")).toBe("12:15 a. m.");
  });

  it("drops the hour when the event has no time", () => {
    expect(whenLabel("2026-10-15")).toBe("jueves 15 de octubre");
  });

  it("returns the same string every call, so nothing reads a clock", () => {
    const iso = "2026-10-18T10:00:00.000Z";
    expect(whenLabel(iso)).toBe(whenLabel(iso));
    expect(whenLabel(null)).toBeNull();
    expect(timeLabel12(undefined)).toBeNull();
  });
});

describe("send", () => {
  it("goes Enviando… then Enviado, and only in that order", () => {
    let state = sendReducer("idle", { type: "send" });
    expect(state).toBe("sending");
    state = sendReducer(state, { type: "ok" });
    expect(state).toBe("sent");
  });

  it("offers a retry after a failed send and sends again from there", () => {
    const failed = sendReducer(sendReducer("idle", { type: "send" }), { type: "fail" });
    expect(failed).toBe("failed");
    expect(sendReducer(failed, { type: "send" })).toBe("sending");
    expect(sendReducer(sendReducer(failed, { type: "send" }), { type: "ok" })).toBe("sent");
  });

  it("ignores a response that arrives when nothing is in flight", () => {
    expect(sendReducer("idle", { type: "ok" })).toBe("idle");
    expect(sendReducer("failed", { type: "ok" })).toBe("failed");
  });

  it("does not restart a request that is already running", () => {
    expect(sendReducer("sending", { type: "send" })).toBe("sending");
  });

  it("drops the sent seal when the caregiver edits the card again", () => {
    expect(sendReducer("sent", { type: "edit" })).toBe("idle");
    expect(sendReducer("failed", { type: "edit" })).toBe("failed");
  });

  it("only sends once approved, with no emergency words and nothing in flight", () => {
    expect(canSend({ approved: true, state: "idle", emergency: false })).toBe(true);
    expect(canSend({ approved: false, state: "idle", emergency: false })).toBe(false);
    expect(canSend({ approved: true, state: "sending", emergency: false })).toBe(false);
    expect(canSend({ approved: true, state: "idle", emergency: true })).toBe(false);
    expect(canSend({ approved: true, state: "idle", emergency: false, busy: true })).toBe(false);
  });

  it("folds the just sent card in so the screen does not wait on the poll", () => {
    const card = event({ kind: "weekcard", status: "CONFIRMADO", payload: { items: [] } });
    const merged = mergeEvent([appointment], card);
    expect(merged.map((e) => e.id)).toEqual([appointment.id, card.id]);
    expect(mergeEvent([card], null)).toEqual([card]);
  });

  it("keeps the newest copy when the poll catches up with its own", () => {
    const stale = event({ id: "evt-1", kind: "weekcard", status: "BORRADOR", updatedAt: "2026-10-09T08:00:00.000Z" });
    const fresh = { ...stale, status: "CONFIRMADO" as const, updatedAt: "2026-10-09T09:00:00.000Z" };
    expect(mergeEvent([stale], fresh)[0]!.status).toBe("CONFIRMADO");
    expect(mergeEvent([fresh], stale)[0]!.status).toBe("CONFIRMADO");
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
