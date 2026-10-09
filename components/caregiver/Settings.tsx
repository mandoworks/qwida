"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { useEvents } from "@/lib/client/useEvents";
import { buildIcs, ICS_FILENAME } from "@/lib/weekcard/ics";
import { confirmedAppointments } from "@/lib/weekcard/digest";
import type { StringKey } from "@/lib/weekcard/strings";
import { useLang } from "./lang-context";

const INTERVALS = ["daily", "every3", "weekly"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_LABEL: Record<Interval, StringKey> = {
  daily: "settings.digest.daily",
  every3: "settings.digest.every3",
  weekly: "settings.digest.weekly",
};

/** Digest interval (SIMULADO), caregiver language, and a real .ics export. */
export function Settings() {
  const { events } = useEvents();
  const { t, lang, setLang } = useLang();
  const [saved, setSaved] = useLocalValue("quida.cuidador.digest");
  const interval: Interval = INTERVALS.includes(saved as Interval) ? (saved as Interval) : "daily";
  const setInterval = (next: Interval) => setSaved(next);
  const [downloaded, setDownloaded] = useState<number | null>(null);

  const appointments = confirmedAppointments(events);

  function download() {
    const ics = buildIcs(events, { now: new Date().toISOString() });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = ICS_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(appointments.length);
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-3xl font-bold">{t("settings.title")}</h2>

      <section aria-label={t("settings.digest")} className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-2xl font-bold">{t("settings.digest")}</h3>
          <Badge kind="SIMULADO" />
        </div>
        <p className="text-ink-soft">{t("settings.digest.simulated")}</p>
        <fieldset>
          <legend className="sr-only">{t("settings.digest")}</legend>
          <div className="flex flex-wrap gap-2">
            {INTERVALS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setInterval(code)}
                aria-pressed={interval === code}
                className={`min-h-11 rounded-xl border-2 px-4 font-bold ${
                  interval === code ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
                }`}
              >
                {t(INTERVAL_LABEL[code])}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-label={t("settings.lang")} className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-5">
        <h3 className="text-2xl font-bold">{t("settings.lang")}</h3>
        <p className="text-ink-soft">{t("settings.lang.hint")}</p>
        <div className="flex gap-2">
          {(["es", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`min-h-11 rounded-xl border-2 px-4 font-bold ${
                lang === code ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
              }`}
            >
              {t(code === "es" ? "lang.es" : "lang.en")}
            </button>
          ))}
        </div>
      </section>

      <section aria-label={t("settings.ics")} className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-2xl font-bold">{t("settings.ics")}</h3>
          <Badge kind="SIMULADO" />
        </div>
        <p className="text-ink-soft">{t("settings.ics.hint")}</p>
        <button
          type="button"
          onClick={download}
          disabled={appointments.length === 0}
          className="min-h-12 self-start rounded-xl border-2 border-ink bg-surface px-4 font-bold disabled:opacity-50"
        >
          {t("settings.ics.button")}
        </button>
        {downloaded !== null && (
          <p role="status" className="font-bold text-ok">
            {appointments.length === 0 ? t("settings.ics.empty") : t("settings.ics.done", { n: downloaded })}
          </p>
        )}
      </section>
    </div>
  );
}
