"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { ResetDemoButton } from "@/components/ResetDemoButton";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { useEvents } from "@/lib/client/useEvents";
import { confirmedAppointments } from "@/lib/weekcard/digest";
import { buildIcs, ICS_FILENAME } from "@/lib/weekcard/ics";
import type { StringKey } from "@/lib/weekcard/strings";
import { Download, Globe } from "./icons";
import { useLang } from "./lang-context";

const DETAIL = ["brief", "points", "full"] as const;
type Detail = (typeof DETAIL)[number];

const DETAIL_LABEL: Record<Detail, StringKey> = {
  brief: "settings.detail.brief",
  points: "settings.detail.points",
  full: "settings.detail.full",
};

const CHANNELS = ["whatsapp", "call", "both"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABEL: Record<Channel, StringKey> = {
  whatsapp: "settings.channel.whatsapp",
  call: "settings.channel.call",
  both: "settings.channel.both",
};

/** Digest detail (SIMULADO), caregiver language, contrast, .ics export, sharing. */
export function Settings() {
  const { events } = useEvents();
  const { t, lang, setLang } = useLang();
  const [savedDetail, setSavedDetail] = useLocalValue("quida.cuidador.detail");
  const detail: Detail = DETAIL.includes(savedDetail as Detail) ? (savedDetail as Detail) : "points";
  const [savedChannel, setSavedChannel] = useLocalValue("quida.cuidador.channel");
  const channel: Channel = CHANNELS.includes(savedChannel as Channel) ? (savedChannel as Channel) : "call";
  const [savedContrast, setSavedContrast] = useLocalValue("quida.cuidador.contrast");
  const highContrast = savedContrast === "high";
  const [downloaded, setDownloaded] = useState<number | null>(null);

  // The high contrast theme is real: it flips data-contrast on <html> (5.10 item 4).
  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? "high" : "";
  }, [highContrast]);

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
      <h2 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("settings.title")}</h2>

      <fieldset className="flex flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
        <legend className="flex items-center gap-2 text-c-title font-bold">
          {t("settings.detail")}
          <Badge kind="SIMULADO" />
        </legend>
        <div role="radiogroup" aria-label={t("settings.detail")} className="flex flex-col">
          {DETAIL.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={detail === code}
              onClick={() => setSavedDetail(code)}
              className={`flex min-h-tap-c-lg items-center gap-3 border-b border-line px-1 text-left text-c-body motion-quick last:border-b-0 ${
                detail === code ? "font-bold text-accent" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-4 rounded-full border-2 ${detail === code ? "border-accent bg-accent" : "border-line-strong"}`}
              />
              {t(DETAIL_LABEL[code])}
            </button>
          ))}
        </div>
        <p className="text-c-meta text-ink-mute">{t("settings.detail.note")}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
        <legend className="flex items-center gap-2 text-c-title font-bold">
          {t("settings.channel")}
          <Badge kind="SIMULADO" />
        </legend>
        <p className="text-c-meta text-ink-mute">{t("settings.channel.hint")}</p>
        <div role="radiogroup" aria-label={t("settings.channel")} className="flex flex-col">
          {CHANNELS.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={channel === code}
              onClick={() => setSavedChannel(code)}
              className={`flex min-h-tap-c-lg items-center gap-3 border-b border-line px-1 text-left text-c-body motion-quick last:border-b-0 ${
                channel === code ? "font-bold text-accent" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-4 rounded-full border-2 ${channel === code ? "border-accent bg-accent" : "border-line-strong"}`}
              />
              {t(CHANNEL_LABEL[code])}
            </button>
          ))}
        </div>
        <div className="rounded-well bg-sand p-3 text-c-meta text-ink-soft">
          <p className="font-bold text-ink">{t("settings.phone.patient")}</p>
          <p className="mt-1 font-bold text-ink">{t("settings.phone.family")}</p>
          <p className="mt-2 text-ink-mute">{t("settings.channel.note")}</p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
        <legend className="text-c-title font-bold">{t("settings.lang")}</legend>
        <p className="text-c-meta text-ink-mute">{t("settings.lang.hint")}</p>
        <div className="flex gap-2">
          {(["es", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`flex min-h-tap-c items-center gap-2 rounded-full border-2 px-4 text-c-body font-bold motion-quick ${
                lang === code ? "border-accent bg-accent text-white" : "border-line bg-surface"
              }`}
            >
              <Globe size={20} />
              {t(code === "es" ? "lang.es" : "lang.en")}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
        <legend className="text-c-title font-bold">{t("settings.contrast")}</legend>
        <p className="text-c-meta text-ink-mute">{t("settings.contrast.hint")}</p>
        <div className="flex gap-2">
          {(["normal", "high"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setSavedContrast(code)}
              aria-pressed={highContrast === (code === "high")}
              className={`min-h-tap-c rounded-full border-2 px-4 text-c-body font-bold motion-quick ${
                highContrast === (code === "high") ? "border-accent bg-accent text-white" : "border-line bg-surface"
              }`}
            >
              {t(code === "normal" ? "settings.contrast.normal" : "settings.contrast.high")}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
        <legend className="flex items-center gap-2 text-c-title font-bold">
          {t("settings.ics")}
          <Badge kind="SIMULADO" />
        </legend>
        <BigButton
          variant="secondary"
          onClick={download}
          disabled={appointments.length === 0}
          className="min-h-tap-c-lg text-c-body"
          icon={<Download size={20} />}
        >
          {t("settings.ics.button")}
        </BigButton>
        {downloaded !== null && (
          <p role="status" className="rounded-well bg-sand px-3 py-2 text-c-meta text-ink-mute">
            {appointments.length === 0 ? t("settings.ics.empty") : t("settings.ics.downloaded", { n: downloaded })}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
        <legend className="text-c-title font-bold">{t("settings.share")}</legend>
        <ul>
          {[t("settings.share.one"), t("settings.share.two")].map((line) => (
            <li key={line} className="flex min-h-tap-c items-center border-b border-line text-c-body last:border-b-0">
              {line}
            </li>
          ))}
        </ul>
        <details className="mt-2">
          <summary className="min-h-tap-c cursor-pointer py-2 font-bold text-accent underline">
            {t("settings.share.link")}
          </summary>
          <p className="rounded-well bg-sand p-3 text-c-body">
            <strong>{t("settings.consent")}</strong>
            <br />
            {t("settings.consent.line")}
          </p>
        </details>
      </fieldset>

      <div className="flex flex-col items-start gap-4">
        <ResetDemoButton />
        <p className="text-c-meta text-ink-mute">
          {t("settings.credit")} · {t("settings.credit.font")} · {t("settings.credit.model")}
        </p>
      </div>
    </div>
  );
}
