"use client";

import { useState } from "react";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { buildNudges, whatsappUrl, type NudgeKind } from "@/lib/weekcard/nudges";
import type { StringKey } from "@/lib/weekcard/strings";
import { useLang } from "./lang-context";

const KIND_LABEL: Record<NudgeKind, StringKey> = {
  label_rescan: "nudges.label_rescan",
  refill: "nudges.refill",
  referido: "nudges.referido",
  appointment: "nudges.appointment",
};

/**
 * Two taps per reminder: copy the text, or open WhatsApp with it. WhatsApp is a
 * delivery channel only. Quida never sends anything on its own.
 */
export function Nudges() {
  const { events } = useEvents();
  const { t } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const nudges = buildNudges(events, todayPR());

  async function copy(id: string, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-3xl font-bold">{t("nudges.title")}</h2>
        <p className="text-ink-soft">{t("nudges.subtitle")}</p>
      </header>

      {nudges.length === 0 ? (
        <p className="rounded-2xl border-2 border-line bg-surface px-5 py-6 text-ink-soft">{t("nudges.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
          {nudges.map((nudge) => (
            <li key={nudge.id} className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-4">
              <h3 className="text-xl font-bold">{t(KIND_LABEL[nudge.kind])}</h3>
              <p className="rounded-xl border-2 border-line p-3">{nudge.message}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copy(nudge.id, nudge.message)}
                  className="min-h-12 rounded-xl border-2 border-ink bg-surface px-4 font-bold"
                >
                  {copied === nudge.id ? t("nudges.copied") : t("nudges.copy")}
                </button>
                <a
                  href={whatsappUrl(nudge.message)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center rounded-xl border-2 border-accent bg-accent px-4 font-bold text-accent-ink"
                >
                  {t("nudges.whatsapp")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
