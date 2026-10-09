"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import { HOUSEHOLD_ID } from "@/lib/seed";
import { lastWeekcard } from "@/lib/weekcard/digest";
import { CARD_ICONS, CARD_THEMES, type CardItem, type WeekCard } from "@/lib/weekcard/schema";
import type { StringKey } from "@/lib/weekcard/strings";
import { useLang } from "./lang-context";

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

const blankItem = (): CardItem => ({ day: "", text: "", icon: CARD_ICONS[0] });

/**
 * AI drafts the week from the confirmed events, the caregiver edits every line,
 * picks colors and taps send. Only that tap writes the CONFIRMADO `weekcard`
 * the patient side reads.
 */
export function WeekCardEditor() {
  const { events } = useEvents();
  const { t } = useLang();
  const [card, setCard] = useState<WeekCard | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previous = lastWeekcard(events);

  function edit(next: WeekCard) {
    setCard(next);
    setSent(false);
    setError(null);
  }

  const setItem = (index: number, patch: Partial<CardItem>) =>
    edit({ ...card!, items: card!.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

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
      edit(draft.card);
      setSimulated(draft.simulated);
      setRemoved(draft.removed);
      setEmergency(draft.emergency);
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
    } catch {
      setError(t("card.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-3xl font-bold">{t("card.title")}</h2>
        <p className="text-ink-soft">{t("card.subtitle")}</p>
      </header>

      {emergency && <EmergencyBanner />}

      <div className="flex flex-wrap items-center gap-2">
        <BigButton onClick={generate} disabled={busy} className="min-h-14 py-3 text-xl">
          {busy && !card ? t("card.generating") : t("card.generate")}
        </BigButton>
        {simulated && <Badge kind="SIMULADO" />}
        {card && !sent && <Badge kind="BORRADOR" />}
        {sent && <Badge kind="CONFIRMADO" />}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-surface px-4 py-3 text-danger">
          {error}
        </p>
      )}
      {sent && <p className="rounded-2xl border-2 border-ok bg-surface px-4 py-3 font-bold text-ok">{t("card.sent")}</p>}
      {removed.length > 0 && (
        <p className="rounded-2xl border-2 border-warn bg-surface px-4 py-3 text-warn">
          {t("card.stripped", { n: removed.length })}
        </p>
      )}
      {emergency && card && <FenceNotice />}

      {!card ? (
        <p className="rounded-2xl border-2 border-line bg-surface px-5 py-6 text-ink-soft">{t("card.empty")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-1">
              <span className="font-bold">{t("card.heading")}</span>
              <input
                value={card.title}
                onChange={(e) => edit({ ...card, title: e.target.value })}
                className="min-h-12 rounded-xl border-2 border-ink bg-surface px-3"
              />
            </label>

            <section aria-label={t("card.items")} className="flex flex-col gap-3">
              <h3 className="text-xl font-bold">{t("card.items")}</h3>
              {card.items.map((item, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-2xl border-2 border-line bg-surface p-3">
                  <div className="flex gap-2">
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-ink-soft">{t("card.day")}</span>
                      <input
                        value={item.day}
                        onChange={(e) => setItem(i, { day: e.target.value })}
                        className="min-h-11 rounded-lg border-2 border-ink bg-surface px-2"
                      />
                    </label>
                    <label className="flex w-28 flex-col gap-1">
                      <span className="text-ink-soft">{t("card.time")}</span>
                      <input
                        value={item.time ?? ""}
                        onChange={(e) => setItem(i, { time: e.target.value || undefined })}
                        className="min-h-11 rounded-lg border-2 border-ink bg-surface px-2"
                      />
                    </label>
                    <label className="flex w-20 flex-col gap-1">
                      <span className="text-ink-soft">{t("card.icon")}</span>
                      <select
                        value={item.icon ?? CARD_ICONS[0]}
                        onChange={(e) => setItem(i, { icon: e.target.value })}
                        className="min-h-11 rounded-lg border-2 border-ink bg-surface px-1"
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
                    <span className="text-ink-soft">{t("card.text")}</span>
                    <textarea
                      value={item.text}
                      rows={2}
                      onChange={(e) => setItem(i, { text: e.target.value })}
                      className="rounded-lg border-2 border-ink bg-surface px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => edit({ ...card, items: card.items.filter((_, j) => j !== i) })}
                    className="self-start font-bold text-danger underline"
                  >
                    {t("card.remove")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => edit({ ...card, items: [...card.items, blankItem()] })}
                className="min-h-11 self-start rounded-xl border-2 border-ink bg-surface px-4 font-bold"
              >
                {t("card.addItem")}
              </button>
            </section>

            <section aria-label={t("card.questions")} className="flex flex-col gap-2">
              <h3 className="text-xl font-bold">{t("card.questions")}</h3>
              {card.questionsForDoctor.map((question, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    aria-label={t("card.questions")}
                    value={question}
                    onChange={(e) =>
                      edit({ ...card, questionsForDoctor: card.questionsForDoctor.map((q, j) => (j === i ? e.target.value : q)) })
                    }
                    className="min-h-11 flex-1 rounded-lg border-2 border-ink bg-surface px-2"
                  />
                  <button
                    type="button"
                    onClick={() => edit({ ...card, questionsForDoctor: card.questionsForDoctor.filter((_, j) => j !== i) })}
                    className="font-bold text-danger underline"
                  >
                    {t("card.removeQuestion")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => edit({ ...card, questionsForDoctor: [...card.questionsForDoctor, ""] })}
                className="min-h-11 self-start rounded-xl border-2 border-ink bg-surface px-4 font-bold"
              >
                {t("card.addQuestion")}
              </button>
            </section>

            <fieldset className="flex flex-col gap-2">
              <legend className="font-bold">{t("card.theme")}</legend>
              <div className="flex flex-wrap gap-2">
                {CARD_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={card.theme?.primary === theme.primary}
                    onClick={() => edit({ ...card, theme: { primary: theme.primary, accent: theme.accent } })}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 font-bold ${
                      card.theme?.primary === theme.primary ? "border-ink" : "border-line"
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
          </div>

          <section aria-label={t("card.subtitle")} className="flex flex-col gap-3">
            <h3 className="text-xl font-bold">{t("card.subtitle")}</h3>
            <div
              className="rounded-2xl p-5"
              style={card.theme ? { backgroundColor: card.theme.primary, color: "#ffffff" } : { backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
            >
              <h4 className="text-2xl font-bold">{card.title || "..."}</h4>
              <ul className="mt-4 flex flex-col gap-3">
                {card.items.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    {item.icon && <span aria-hidden="true" className="text-2xl leading-none">{item.icon}</span>}
                    <div className="min-w-0">
                      <p
                        className="w-fit rounded px-2 py-0.5 font-bold"
                        style={card.theme ? { backgroundColor: card.theme.accent, color: "#ffffff" } : undefined}
                      >
                        {item.day}
                        {item.time ? `, ${item.time}` : ""}
                      </p>
                      <p>{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {previous && (
              <p className="text-ink-soft">
                {t("card.previous")}: {String(previous.payload.title ?? "")}
              </p>
            )}

            <BigButton onClick={send} disabled={busy || emergency} className="min-h-14 py-3 text-xl">
              {busy ? t("card.sending") : t("card.send")}
            </BigButton>
          </section>
        </div>
      )}
    </div>
  );
}
