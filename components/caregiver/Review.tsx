"use client";

import { useState } from "react";
import { ExtractedFields } from "@/components/photo/ExtractedFields";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import type { QuidaEvent } from "@/lib/store/types";
import { lowConfidence, pendingItems } from "@/lib/weekcard/digest";
import { relativeTime } from "@/lib/weekcard/format";
import type { HeardPrescription } from "@/lib/visit/schema";
import type { StringKey } from "@/lib/weekcard/strings";
import { useClock } from "./clock";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

const PHOTO_KINDS = new Set(["rx_handwritten", "rx_label"]);

/** Fields a person can fix on a non photo item, per event kind. */
const FIELDS: Partial<Record<QuidaEvent["kind"], { name: string; key: StringKey; type?: string }[]>> = {
  appointment: [
    { name: "specialty", key: "review.specialty" },
    { name: "doctor", key: "timeline.fact.doctor" },
    { name: "place", key: "timeline.fact.place" },
    { name: "date", key: "review.date", type: "date" },
  ],
  referido: [
    { name: "specialty", key: "review.specialty" },
    { name: "referring_doctor", key: "timeline.fact.doctor" },
  ],
  lab: [
    { name: "test", key: "digest.change.lab" },
    { name: "timing_text", key: "timeline.fact.when" },
  ],
  doctor_note: [{ name: "topic", key: "digest.change.doctorNote" }],
  voice_note: [{ name: "text", key: "review.transcript" }],
  fence: [{ name: "context", key: "timeline.fact.source" }],
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The queue of everything a person still has to look at, plus the review views. */
export function Review() {
  const { events } = useEvents();
  const { t } = useLang();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [prescriptions, setPrescriptions] = useState<HeardPrescription[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const clock = useClock();
  const now = clock === null ? null : new Date(clock);

  const ids = new Set(pendingItems(events).map((p) => p.id));
  const queue = events.filter((e) => ids.has(e.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const event = queue.find((e) => e.id === selected) ?? null;

  function open(id: string) {
    const target = events.find((e) => e.id === id);
    setSelected(id);
    setEditing(false);
    setError(null);
    setDone(null);
    setFields(
      Object.fromEntries(
        (FIELDS[target?.kind ?? "visit"] ?? []).map((f) => [f.name, str(target?.payload[f.name])]),
      ),
    );
    const heard = target?.payload.prescriptions;
    setPrescriptions(Array.isArray(heard) ? (heard as HeardPrescription[]) : []);
  }

  /**
   * Status only, or status plus a shallow payload merge (PATCH /api/events).
   * The server only accepts CONFIRMADO with `confirmedBy`: this screen is the caregiver's tap.
   */
  async function patch(id: string, body: { status?: QuidaEvent["status"]; payload?: Record<string, unknown> }) {
    const res = await fetch("/api/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body, confirmedBy: "caregiver" }),
    });
    return res.ok;
  }

  async function confirmPlain(e: QuidaEvent) {
    setBusy(true);
    setError(null);
    try {
      if (!(await patch(e.id, { status: "CONFIRMADO" }))) setError(t("review.error"));
      else setDone(e.id);
    } catch {
      setError(t("review.error"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * The correction edits the event in place: one PATCH with the edited payload
   * and the new status. No duplicate event, no link to follow.
   */
  async function confirmCorrected(e: QuidaEvent) {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { editedBy: "caregiver" };
      for (const field of FIELDS[e.kind] ?? []) {
        const value = (fields[field.name] ?? "").trim();
        payload[field.name] = value === "" ? null : value;
      }
      if (e.kind === "visit") payload.prescriptions = prescriptions;
      if (!(await patch(e.id, { status: "CONFIRMADO", payload }))) setError(t("review.error"));
      else setDone(e.id);
    } catch {
      setError(t("review.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!now) {
    return (
      <Pending label={t("review.loading")}>
        <div className="h-40 rounded-card border-2 border-line bg-surface" />
      </Pending>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("review.title")}</h2>

      {done && !event && <p className="rounded-card border-2 border-ok bg-surface px-5 py-4 font-bold text-ok">{t("review.confirmed")}</p>}
        <p className="rounded-card border-2 border-line-strong bg-surface shadow-card px-5 py-6">{t("review.empty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("review.title")}</h2>

      {done && !event && <p className="rounded-card border-2 border-ok bg-surface px-5 py-4 font-bold text-ok">{t("review.confirmed")}</p>}

      <div className="lg:grid lg:grid-cols-[20rem_1fr] lg:gap-6">
        <section aria-label={t("review.queue")} className="flex flex-col gap-2">
          {queue.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => open(e.id)}
              aria-current={selected === e.id ? "true" : undefined}
              className={`flex min-h-tap-c flex-col gap-1 rounded-card border-2 px-4 py-3 text-left motion-quick ${
                selected === e.id ? "border-accent bg-surface" : "border-line bg-surface"
              }`}
            >
              <span className="font-bold">{itemLabel(e, t)}</span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge kind={e.status} />
                {lowConfidence(e) && <span className="font-bold text-warn">{t("review.lowConfidence")}</span>}
                <span className="ml-auto text-c-meta tabular-nums text-ink-mute">{now ? ago(e.createdAt, now, t) : null}</span>
              </span>
            </button>
          ))}
        </section>

        <section aria-label={t("review.select")} className="mt-4 min-w-0 lg:mt-0">
          {!event ? (
            <p className="rounded-card border-2 border-line-strong bg-surface shadow-card px-5 py-6 text-ink-soft">{t("review.select")}</p>
          ) : (
            <article className="flex flex-col gap-4 rounded-card border-2 border-line-strong bg-surface shadow-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-c-title font-bold">{itemLabel(event, t)}</h3>
                <Badge kind={done === event.id ? "CONFIRMADO" : event.status} />
                {event.payload.simulated === true && <Badge kind="SIMULADO" />}
              </div>

              {event.kind === "fence" && (
                <>
                  {event.payload.emergency === true && <EmergencyBanner />}
                  <FenceNotice />
                </>
              )}

              {PHOTO_KINDS.has(event.kind) || event.payload.fields ? (
                <ExtractedFields event={event} householdId={event.householdId} size="caregiver" onConfirmed={() => setDone(event.id)} />
              ) : (
                <ItemReview
                  event={event}
                  editing={editing}
                  fields={fields}
                  prescriptions={prescriptions}
                  onField={(name, value) => setFields((prev) => ({ ...prev, [name]: value }))}
                  onPrescription={(index, patch) =>
                    setPrescriptions((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
                  }
                  t={t}
                />
              )}

              {error && (
                <p role="alert" className="rounded-well border-2 border-danger bg-surface px-4 py-3 text-danger">
                  {error}
                </p>
              )}
              {done === event.id && <p className="font-bold text-ok">{t("review.confirmed")}</p>}

              {/* A photo (label, referido or cita card) confirms through its own Confirmar, with the date checks. */}
              {!PHOTO_KINDS.has(event.kind) && !event.payload.fields && event.status !== "CONFIRMADO" && (
                <div className="flex flex-wrap gap-2">
                  <BigButton onClick={() => (editing ? confirmCorrected(event) : confirmPlain(event))} disabled={busy} className="min-h-tap-c-lg text-c-body">
                    {busy ? t("review.confirming") : editing ? t("review.saveCorrect") : t("review.confirm")}
                  </BigButton>
                  <BigButton variant="secondary" onClick={() => setEditing((v) => !v)} disabled={busy} className="min-h-tap-c-lg text-c-body">
                    {editing ? t("review.confirm") : t("review.correct")}
                  </BigButton>
                </div>
              )}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}

function ago(iso: string, now: Date, t: (key: StringKey, values?: Record<string, string | number>) => string): string {
  const { key, n } = relativeTime(iso, now);
  return t(key, { n });
}

function itemLabel(e: QuidaEvent, t: (key: StringKey) => string): string {
  return t(ITEM_LABEL[e.kind] ?? "review.photo");
}

const ITEM_LABEL: Partial<Record<QuidaEvent["kind"], StringKey>> = {
  visit: "digest.change.visit",
  voice_note: "digest.change.visit",
  rx_handwritten: "digest.change.photo",
  rx_label: "digest.change.photo",
  fence: "digest.change.fence",
  appointment: "digest.change.appointment",
  referido: "digest.change.referido",
  lab: "digest.change.lab",
  doctor_note: "digest.change.doctorNote",
};

/** Source quote plus the editable fields for the item being reviewed. */
function ItemReview({
  event,
  editing,
  fields,
  prescriptions,
  onField,
  onPrescription,
  t,
}: {
  event: QuidaEvent;
  editing: boolean;
  fields: Record<string, string>;
  prescriptions: HeardPrescription[];
  onField: (name: string, value: string) => void;
  onPrescription: (index: number, patch: Partial<HeardPrescription>) => void;
  t: (key: StringKey, values?: Record<string, string | number>) => string;
}) {
  const specs = FIELDS[event.kind] ?? [];
  return (
    <div className="flex flex-col gap-4">
      {specs.map((field) => (
        <label key={field.name} className="flex flex-col gap-1">
          <span className="text-ink-soft">{t(field.key)}</span>
          {editing ? (
            <input
              type={field.type ?? "text"}
              value={fields[field.name] ?? ""}
              onChange={(e) => onField(field.name, e.target.value)}
              className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3"
            />
          ) : (
            <span className="font-bold">{fields[field.name] || "—"}</span>
          )}
        </label>
      ))}

      {prescriptions.length > 0 && (
        <div>
          <h4 className="mb-2 text-c-subtitle font-bold">{t("review.drug")}</h4>
          <ul className="flex flex-col gap-3">
            {prescriptions.map((p, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-well border-2 border-line p-3">
                {(
                  [
                    ["drug", t("review.drug")],
                    ["dose", t("review.dose")],
                    ["frequency", t("review.frequency")],
                  ] as const
                ).map(([name, label]) => (
                  <label key={name} className="flex flex-col gap-1">
                    <span className="text-ink-soft">{label}</span>
                    {editing ? (
                      <input
                        value={str(p[name])}
                        onChange={(e) => onPrescription(i, { [name]: e.target.value })}
                        className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3"
                      />
                    ) : (
                      <span className="font-bold">{str(p[name]) || "—"}</span>
                    )}
                  </label>
                ))}
                <blockquote className="border-l-4 border-accent pl-3 italic text-ink-soft">“{str(p.source_quote)}”</blockquote>
              </li>
            ))}
          </ul>
        </div>
      )}

      {typeof event.payload.source_quote === "string" && (
        <blockquote className="border-l-4 border-accent pl-3 italic">“{event.payload.source_quote}”</blockquote>
      )}

      {typeof event.payload.transcript === "string" && (
        <details>
          <summary className="cursor-pointer font-bold">{t("review.transcript")}</summary>
          <p className="mt-2 whitespace-pre-line rounded-well border-2 border-line p-3 text-ink-soft">{event.payload.transcript}</p>
        </details>
      )}

      {Array.isArray(event.payload.questions_back) && event.payload.questions_back.length > 0 && (
        <div className="rounded-well border-2 border-warn p-3">
          <h4 className="text-c-subtitle font-bold text-warn">{t("review.questions")}</h4>
          <ul className="list-disc pl-5">
            {(event.payload.questions_back as string[]).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
