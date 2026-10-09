"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { useEvents } from "@/lib/client/useEvents";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { lastWeekcard } from "@/lib/weekcard/digest";
import { CARD_ICONS, CARD_THEMES, type CardItem, type WeekCard } from "@/lib/weekcard/schema";
import type { StringKey } from "@/lib/weekcard/strings";
import { useClock } from "./clock";
import { Clock, Pencil, Plus, Seal, X } from "./icons";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

type DraftResponse = {
  card: WeekCard;
  simulated: boolean;
  removed: string[];
  emergency: boolean;
};

const THEME_LABEL: Record<(typeof CARD_THEMES)[number]["id"], StringKey> = {
  azul: "card.theme.azul",
  rojo: "card.theme.rojo",
  verde: "card.theme.verde",
};

const AUTOSAVE_MS = 3000;
const DRAFT_KEY = "quida.cuidador.draftId";
const MAX_QUESTION = 120;

const blankItem = (): CardItem => ({ day: "", text: "", icon: CARD_ICONS[0] });

/**
 * AI drafts the week from the confirmed events, the caregiver edits every line,
 * taps Aprobar and then Enviar a Mamá (4.10, 5.7). Only that last tap writes the
 * CONFIRMADO `weekcard` the patient side reads.
 */
export function WeekCardEditor() {
  const { events } = useEvents();
  const { t } = useLang();
  const clock = useClock();
  const [card, setCard] = useState<WeekCard | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [approved, setApproved] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDraftId, setSavedDraftId] = useLocalValue(DRAFT_KEY);
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftId = useRef<string | null>(savedDraftId ?? null);

  const previous = lastWeekcard(events);
  // Read only: the schedule the pharmacy label already confirmed (4.10).
  const confirmedMeds = events
    .filter((e) => e.kind === "med_schedule" && e.status === "CONFIRMADO")
    .map((e) => ({
      id: e.id,
      drug: typeof e.payload.drug === "string" ? e.payload.drug : "",
      dose: typeof e.payload.dose === "string" ? e.payload.dose : null,
    }))
    .filter((m) => m.drug !== "");

  function edit(next: WeekCard) {
    setCard(next);
    setApproved(false);
    setSent(false);
    setError(null);
  }

  const setItem = (index: number, patch: Partial<CardItem>) =>
    edit({ ...card!, items: card!.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  // Autosave every 3 s into one BORRADOR event, so we do not spam the store (4.10).
  useEffect(() => {
    if (!card) return;
    if (autosave.current) clearTimeout(autosave.current);
    autosave.current = setTimeout(async () => {
      const payload = { synthetic: true, simulated, status: "draft", ...card };
      try {
        if (draftId.current) {
          const res = await fetch("/api/events", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: draftId.current, payload }),
          });
          if (res.ok) return;
          draftId.current = null;
        }
        const created = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ householdId: HOUSEHOLD_ID, kind: "weekcard", source: "caregiver", payload }),
        });
        const data = await created.json();
        if (created.ok && data?.event?.id) {
          draftId.current = data.event.id;
          setSavedDraftId(data.event.id);
        }
      } catch {
        // The draft is a convenience: the editor keeps working without it.
      }
    }, AUTOSAVE_MS);
    return () => {
      if (autosave.current) clearTimeout(autosave.current);
    };
  }, [card, simulated, setSavedDraftId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/weekcard/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: HOUSEHOLD_ID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "error");
      const draft = data as DraftResponse;
      setCard(draft.card);
      setSimulated(draft.simulated);
      setRemoved(draft.removed);
      setEmergency(draft.emergency);
      setApproved(false);
      setSent(false);
    } catch {
      setError(t("card.error"));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/weekcard/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: HOUSEHOLD_ID, simulated, card }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "error");
      const done = data as DraftResponse;
      setRemoved(done.removed);
      setEmergency(done.emergency);
      setCard(done.card);
      setSent(true);
      draftId.current = null;
    } catch {
      setError(t("card.error"));
    } finally {
      setBusy(false);
    }
  }

  if (clock === null) {
    return (
      <Pending label={t("card.loading")}>
        <div className="h-40 rounded-card border-2 border-line bg-surface" />
      </Pending>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {emergency && <EmergencyBanner />}

      <header className="flex flex-wrap items-center gap-2">
        <h2 className="scroll-mt-24 mr-auto text-c-hero font-bold leading-tight">{t("card.title")}</h2>
        {sent && <Badge kind="CONFIRMADO" />}
        {!sent && card && <Badge kind="BORRADOR" />}
        {simulated && <Badge kind="SIMULADO" />}
        {events.length > 0 && (
          <span role="status" aria-live="polite" className="flex items-center gap-2 text-c-meta text-ink-mute">
            <span aria-hidden="true" className="size-2 rounded-full bg-ok" />
            <Clock size={16} />
            {t("digest.updated")}
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <BigButton onClick={generate} disabled={busy} className="min-h-tap-c-lg w-auto text-c-body">
          {busy && !card ? t("card.generating") : t("card.generate")}
        </BigButton>
        <p className="text-c-meta text-ink-mute">{t("card.subtitle")}</p>
      </div>

      {error && (
        <p role="alert" className="rounded-card border-2 border-danger bg-surface px-4 py-3 text-c-body text-danger">
          {error}
        </p>
      )}
      {removed.length > 0 && (
        <p className="rounded-card border-2 border-warn bg-warn-soft px-4 py-3 text-c-body text-warn">
          {t("card.stripped", { n: removed.length })}
        </p>
      )}
      {emergency && card && <FenceNotice />}

      {!card ? (
        <p className="rounded-card border-2 border-line bg-surface px-5 py-6 text-c-body text-ink-soft">{t("card.empty")}</p>
      ) : (
        <div className="md:grid md:grid-cols-[1fr_560px] md:gap-6">
          {/* Editor column */}
          <div className="flex flex-col gap-4">
            <section aria-label={t("card.heading")} className="rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
              <label className="flex flex-col gap-1">
                <span className="text-c-subtitle font-bold">{t("card.heading")}</span>
                <input
                  value={card.title}
                  onChange={(e) => edit({ ...card, title: e.target.value })}
                  className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3 text-c-body"
                />
              </label>
            </section>

            <section aria-label={t("card.citas")} className="rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
              <h3 className="mb-3 text-c-title font-bold">{t("card.citas")}</h3>
              <div className="flex flex-col gap-3">
                {card.items.map((item, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-well border-2 border-line p-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="flex flex-1 flex-col gap-1">
                        <span className="text-c-meta text-ink-mute">{t("card.day")}</span>
                        <input
                          value={item.day}
                          onChange={(e) => setItem(i, { day: e.target.value })}
                          className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-2 text-c-body"
                        />
                      </label>
                      <label className="flex w-28 flex-col gap-1">
                        <span className="text-c-meta text-ink-mute">{t("card.time")}</span>
                        <input
                          value={item.time ?? ""}
                          onChange={(e) => setItem(i, { time: e.target.value || undefined })}
                          className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-2 text-c-body"
                        />
                      </label>
                      <label className="flex w-24 flex-col gap-1">
                        <span className="text-c-meta text-ink-mute">{t("card.icon")}</span>
                        <select
                          value={item.icon ?? CARD_ICONS[0]}
                          onChange={(e) => setItem(i, { icon: e.target.value })}
                          className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-1 text-c-body"
                        >
                          {CARD_ICONS.map((icon) => (
                            <option key={icon} value={icon}>
                              {icon}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-c-meta text-ink-mute">{t("card.text")}</span>
                      <textarea
                        value={item.text}
                        rows={2}
                        onChange={(e) => setItem(i, { text: e.target.value })}
                        className="rounded-btn border-2 border-line-strong bg-surface px-2 py-1 text-c-body"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => edit({ ...card, items: move(card.items, i, -1) })}
                        className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3 text-c-meta font-bold disabled:opacity-40"
                      >
                        {t("card.up")}
                      </button>
                      <button
                        type="button"
                        disabled={i === card.items.length - 1}
                        onClick={() => edit({ ...card, items: move(card.items, i, 1) })}
                        className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3 text-c-meta font-bold disabled:opacity-40"
                      >
                        {t("card.down")}
                      </button>
                      <button
                        type="button"
                        onClick={() => edit({ ...card, items: card.items.filter((_, j) => j !== i) })}
                        className="flex min-h-tap-c items-center gap-1 rounded-btn border-2 border-line-strong bg-surface px-3 text-c-meta font-bold"
                      >
                        <X size={16} />
                        {t("card.remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => edit({ ...card, items: [...card.items, blankItem()] })}
                className="mt-3 flex min-h-tap-c items-center gap-1 rounded-btn border-2 border-line-strong bg-surface px-4 font-bold"
              >
                <Plus size={16} />
                {t("card.addItem")}
              </button>
            </section>

            {/* Read only: what the pharmacy label already confirmed. */}
            <section aria-label={t("card.meds")} className="rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
              <h3 className="mb-2 text-c-title font-bold">{t("card.meds")}</h3>
              <ul className="flex flex-col gap-1 text-c-body">
                {confirmedMeds.length === 0 ? (
                  <li className="text-ink-soft">{t("card.medsNone")}</li>
                ) : (
                  confirmedMeds.map((med) => (
                    <li key={med.id} className="flex items-center gap-2">
                      <PillGlyph />
                      {med.drug}
                      {med.dose ? <span className="tabular-nums text-ink-soft">{med.dose}</span> : null}
                    </li>
                  ))
                )}
              </ul>
              <p className="mt-2 text-c-meta text-ink-mute">{t("card.medsNote")}</p>
              <Link href="/cuidador/revisar" className="text-c-body font-bold text-accent underline">
                {t("card.medsLink")}
              </Link>
            </section>

            <section aria-label={t("card.questions")} className="rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
              <h3 className="mb-2 text-c-title font-bold">{t("card.questions")}</h3>
              <div className="flex flex-col gap-2">
                {card.questionsForDoctor.slice(0, 2).map((question, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea
                      aria-label={t("card.questions")}
                      value={question}
                      maxLength={MAX_QUESTION}
                      rows={2}
                      onChange={(e) =>
                        edit({
                          ...card,
                          questionsForDoctor: card.questionsForDoctor.map((q, j) => (j === i ? e.target.value : q)),
                        })
                      }
                      className="flex-1 rounded-btn border-2 border-line-strong bg-surface px-2 py-1 text-c-body"
                    />
                    <button
                      type="button"
                      onClick={() => edit({ ...card, questionsForDoctor: card.questionsForDoctor.filter((_, j) => j !== i) })}
                      className="flex min-h-tap-c items-center gap-1 rounded-btn border-2 border-line-strong bg-surface px-2 text-c-meta font-bold"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-c-meta text-ink-mute">{t("card.questionsHint")}</p>
            </section>

            <fieldset className="flex flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
              <legend className="text-c-title font-bold">{t("card.theme")}</legend>
              <div className="flex flex-wrap gap-2">
                {CARD_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={card.theme?.primary === theme.primary}
                    onClick={() => edit({ ...card, theme: { primary: theme.primary, accent: theme.accent } })}
                    className={`flex min-h-tap-c items-center gap-2 rounded-btn border-2 px-3 font-bold ${
                      card.theme?.primary === theme.primary ? "border-ink bg-accent-soft" : "border-line bg-surface"
                    }`}
                  >
                    <span aria-hidden="true" className="flex gap-1">
                      <span className="size-5 rounded" style={{ backgroundColor: theme.primary }} />
                      <span className="size-5 rounded" style={{ backgroundColor: theme.accent }} />
                    </span>
                    {t(THEME_LABEL[theme.id])}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-c-meta text-ink-mute">
              <Pencil size={16} className="mr-1 inline" />
              {t("card.resendNote")}
            </p>

            {/* Autosave row, SIMULADO (4.10). */}
            <p className="flex flex-wrap items-center gap-2 text-c-meta text-ink-mute">
              <Badge kind="SIMULADO" />
              <span className="font-bold">{t("card.autosave")}</span>
              <span className="rounded-well bg-sand px-2 py-1">{t("card.autosaveNote")}</span>
            </p>

            {sent ? (
              <div role="status" className="flex flex-col gap-2 rounded-card bg-ok-soft p-4">
                <p className="flex items-center gap-2 text-c-title font-bold text-ok">
                  <Seal size={24} />
                  {t("card.sentTo")}
                </p>
                <Link href="/paciente/tarjeta" className="text-c-body font-bold text-accent underline">
                  {t("card.viewAs")}
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <BigButton variant="secondary" onClick={() => setApproved(true)} className="min-h-tap-c-lg w-auto text-c-body">
                  {approved ? t("card.approved") : t("card.approve")}
                </BigButton>
                <BigButton
                  onClick={send}
                  disabled={!approved || busy || emergency}
                  aria-describedby={approved ? undefined : "send-hint"}
                  className="min-h-tap-c-lg w-auto text-c-body"
                >
                  {busy ? t("card.sending") : t("card.send")}
                </BigButton>
                {!approved && (
                  <p id="send-hint" className="w-full text-c-meta text-ink-mute">
                    {t("card.sendHint")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Live preview in a 390 x 780 phone frame (5.7). */}
          <div className="md:sticky md:top-6 md:self-start">
            <h3 className="mb-2 text-c-subtitle font-bold">{t("card.subtitle")}</h3>
            <div className="h-[780px] w-[390px] max-w-full overflow-y-auto rounded-card border-2 border-line-strong bg-surface">
              <div
                className="p-5"
                style={card.theme ? { backgroundColor: card.theme.primary, color: "#ffffff" } : undefined}
              >
                <p className="text-c-meta opacity-80">{t("card.previewLabel")}</p>
                <h4 className="text-c-title font-bold">{card.title || "..."}</h4>
              </div>
              <ul className="flex flex-col gap-3 p-5">
                {card.items.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    {item.icon && (
                      <span aria-hidden="true" className="text-c-title leading-none">
                        {item.icon}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p
                        className="w-fit rounded-full bg-ink px-3 py-0.5 text-c-label font-bold text-bg"
                        style={card.theme ? { backgroundColor: card.theme.accent, color: "#ffffff" } : undefined}
                      >
                        {item.day}
                        {item.time ? `, ${item.time}` : ""}
                      </p>
                      <p className="text-c-body">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {card.questionsForDoctor.length > 0 && (
                <div className="border-t border-line p-5">
                  <h5 className="text-c-subtitle font-bold">{t("card.questions")}</h5>
                  <ol className="list-decimal pl-5 text-c-body">
                    {card.questionsForDoctor.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            {previous && (
              <p className="mt-2 text-c-meta text-ink-mute">
                {t("card.previous")}: {String(previous.payload.title ?? "")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Swaps one item with its neighbour so the caregiver can reorder the week. */
function move(items: CardItem[], index: number, step: number): CardItem[] {
  const next = [...items];
  const to = index + step;
  if (to < 0 || to >= next.length) return next;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

function PillGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0 text-ink-mute">
      <path d="M10.5 20.5a5 5 0 0 1-7-7l7-7a5 5 0 0 1 7 7z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  );
}
