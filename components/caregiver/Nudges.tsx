"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { buildNudges, whatsappUrl, type NudgeKind } from "@/lib/weekcard/nudges";
import type { StringKey } from "@/lib/weekcard/strings";
import { useClock } from "./clock";
import { Bell, Copy, Message, Phone } from "./icons";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

const KIND_LABEL: Record<NudgeKind, StringKey> = {
  label_rescan: "nudges.label_rescan",
  refill: "nudges.refill",
  referido: "nudges.referido",
  appointment: "nudges.appointment",
};

/**
 * Three delivery options per reminder: copy the text, open WhatsApp, or trigger an automated voice call.
 * Designed for Puerto Rican seniors who do not read text messages but answer the phone.
 */
export function Nudges() {
  const { events } = useEvents();
  const { t } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const [calling, setCalling] = useState<string | null>(null);
  const [called, setCalled] = useState<string | null>(null);
  const clock = useClock();

  if (clock === null) {
    return (
      <Pending label={t("nudges.loading")}>
        <div className="h-40 rounded-card border-2 border-line bg-surface" />
      </Pending>
    );
  }

  const nudges = buildNudges(events, todayPR(new Date(clock)));

  async function copy(id: string, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function triggerCall(id: string, message: string) {
    setCalling(id);
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`Bendición Doña Carmen. De parte de Marisol: ${message}`);
        u.lang = "es-US";
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
      await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "+17875550192",
          recipientName: "Doña Carmen",
          message,
          trigger: id,
        }),
      }).catch(() => {});
      setCalling(null);
      setCalled(id);
      setTimeout(() => setCalled(null), 4000);
    } catch {
      setCalling(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("nudges.title")}</h2>
      <p className="text-c-body text-ink-soft">{t("nudges.lead")}</p>

      {nudges.length === 0 ? (
        <p className="rounded-card border-2 border-line bg-surface px-5 py-6 text-c-body text-ink-soft">{t("nudges.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {nudges.map((nudge) => (
            <li key={nudge.id} className="flex flex-col gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <Bell size={20} className="text-accent" />
                <span className="mr-auto text-c-subtitle font-bold">{t(KIND_LABEL[nudge.kind])}</span>
                <Badge kind="SIMULADO" />
              </div>
              <blockquote className="rounded-well bg-sand p-3 text-c-body">{nudge.message}</blockquote>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => copy(nudge.id, nudge.message)}
                  className="flex min-h-tap-c flex-1 items-center justify-center gap-2 rounded-btn border-2 border-line-strong bg-surface px-4 text-c-body font-bold motion-quick hover:bg-sand"
                >
                  <Copy size={20} />
                  {copied === nudge.id ? t("nudges.copied") : t("nudges.copy")}
                </button>
                <a
                  href={whatsappUrl(nudge.message)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-tap-c flex-1 items-center justify-center gap-2 rounded-btn border-2 border-line-strong bg-surface px-4 text-c-body font-bold motion-quick hover:bg-sand"
                >
                  <Message size={20} />
                  {t("nudges.whatsapp")}
                </a>
                <button
                  type="button"
                  onClick={() => triggerCall(nudge.id, nudge.message)}
                  disabled={calling === nudge.id}
                  className="flex min-h-tap-c flex-1 items-center justify-center gap-2 rounded-btn border-2 border-accent bg-accent px-4 text-c-body font-bold text-white motion-quick hover:bg-accent-press"
                >
                  <Phone size={20} />
                  {calling === nudge.id
                    ? t("nudges.calling")
                    : called === nudge.id
                      ? t("nudges.called")
                      : t("nudges.call")}
                </button>
              </div>
              {called === nudge.id && (
                <div role="status" className="rounded-well bg-sand p-3 text-c-meta font-bold text-accent">
                  ✓ {t("nudges.called")} · (787) 555-0192 (Simulado)
                </div>
              )}
              <p className="text-c-meta text-ink-mute">{t("nudges.foot")}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Send behaviour, stated plainly (5.9 item 4). */}
      <section aria-label={t("nudges.auto")} className="flex flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-c-title font-bold">{t("nudges.auto")}</h3>
          <Badge kind="SIMULADO" />
        </div>
        <p className="rounded-well bg-sand px-3 py-2 text-c-meta text-ink-mute">{t("nudges.autoNote")}</p>
        <p className="rounded-well bg-sand px-3 py-2 text-c-meta text-ink-mute">{t("nudges.callNote")}</p>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {copied ? t("nudges.copiedStatus") : ""}
      </p>

      <FenceNotice />
    </div>
  );
}
