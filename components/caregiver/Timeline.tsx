"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { dayLabel } from "@/lib/weekcard/dates";
import { clockTime } from "@/lib/weekcard/format";
import { filterRows, groupByDay, timelineRows, type TimelineGroup } from "@/lib/weekcard/timeline";
import type { StringKey } from "@/lib/weekcard/strings";
import { useClock } from "./clock";
import { Eye } from "./icons";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

const CHIPS: { id: TimelineGroup | "all"; key: StringKey }[] = [
  { id: "all", key: "timeline.filter.all" },
  { id: "cita", key: "timeline.filter.cita" },
  { id: "receta", key: "timeline.filter.receta" },
  { id: "referido", key: "timeline.filter.referido" },
  { id: "laboratorio", key: "timeline.filter.laboratorio" },
  { id: "indicacion", key: "timeline.filter.indicacion" },
  { id: "nota", key: "timeline.filter.nota" },
  { id: "alerta", key: "timeline.filter.alerta" },
];

/** DESIGN.md 4.13: a native select, the control that works on every phone. */
const SPECIALTIES = ["cardiología", "endocrinología", "medicina general", "neurología"] as const;
const FACT_LABEL: Record<string, StringKey> = {
  doctor: "timeline.fact.doctor",
  place: "timeline.fact.place",
  specialty: "timeline.fact.specialty",
  date: "timeline.fact.date",
  expires: "timeline.fact.expires",
  prescriptions: "timeline.fact.prescriptions",
  questions: "timeline.fact.questions",
  drug: "timeline.fact.drug",
  source: "timeline.fact.source",
  when: "timeline.fact.when",
  quote: "timeline.fact.quote",
};

/** Everything medical in order, filtered by type and by specialty (5.6). */
export function Timeline() {
  const { events } = useEvents();
  const { t } = useLang();
  const [group, setGroup] = useState<TimelineGroup | "all">("all");
  const [specialty, setSpecialty] = useState("");
  const [typed, setTyped] = useState("");

  const clock = useClock();
  const now = clock === null ? null : new Date(clock);
  const today = clock === null ? null : now ? todayPR(now) : null;

  if (!now || !today) {
    return (
      <Pending label={t("timeline.loading")}>
        <div className="h-40 rounded-card border-2 border-line bg-surface" />
      </Pending>
    );
  }

  const all = timelineRows(events);
  const rows = filterRows(all, group, specialty);
  const groups = groupByDay(rows, today);
  const activeSpecialty = specialty === "" ? "" : specialty === "otra" ? typed : specialty;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("timeline.title")}</h2>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-6">
        {/* Filter rail, sticky on lg (4.13). */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-c-subtitle font-bold">{t("timeline.filter.type")}</legend>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setGroup(chip.id)}
                  aria-pressed={group === chip.id}
                  className={`min-h-tap-c rounded-full border-2 px-4 text-c-label font-bold uppercase tracking-wide motion-quick ${
                    group === chip.id
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink hover:border-line-strong"
                  }`}
                >
                  {t(chip.key)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-c-subtitle font-bold">{t("timeline.filter.specialty")}</span>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3 text-c-body"
            >
              <option value="">{t("timeline.filter.all")}</option>
              {SPECIALTIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="otra">{t("timeline.other")}</option>
            </select>
          </label>

          {specialty === "otra" && (
            <label className="flex flex-col gap-1">
              <span className="text-c-meta text-ink-mute">{t("timeline.otherLabel")}</span>
              <input
                type="search"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="cardiología"
                className="min-h-tap-c rounded-btn border-2 border-line-strong bg-surface px-3 text-c-body"
              />
            </label>
          )}
        </div>

        <div className="min-w-0">
          {/* Filters never hide the count (4.12). */}
          <p role="status" aria-live="polite" className="mb-3 text-c-meta text-ink-mute">
            {t("timeline.count", {
              n: all.length,
              m: `${rows.length} ${activeSpecialty || t(CHIPS.find((c) => c.id === group)?.key ?? "timeline.filter.all").toLowerCase()}`,
            })}
          </p>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border-2 border-line bg-surface p-8 text-center">
              <Eye size={48} className="text-ink-mute" />
              <p className="text-c-title font-bold">{t("timeline.empty.title")}</p>
              <p className="text-c-body text-ink-soft">{t("timeline.empty.body")}</p>
            </div>
          ) : (
            <ol className="flex flex-col">
              {groups.map((day) => (
                <li key={day.date}>
                  <h3 className="sticky top-0 z-10 bg-sand px-3 py-2 text-c-subtitle font-bold">
                    {day.today ? t("timeline.today") : day.yesterday ? t("timeline.yesterday") : dayLabel(day.date)}
                  </h3>
                  <ul>
                    {day.rows.map((row) => (
                      <li key={row.id} className="flex gap-4 border-b border-line py-4 last:border-b-0">
                        {/* rail */}
                        <div aria-hidden="true" className="flex w-8 shrink-0 flex-col items-center">
                          <span className="h-3 w-px bg-line" />
                          <span className={`my-1 size-3 rounded-full ${row.status === "POR_CONFIRMAR" ? "bg-warn" : "bg-accent"}`} />
                          <span className="h-3 w-px bg-line" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-c-meta tabular-nums text-ink-mute">{clockTime(row.at, "es")}</span>
                            <Badge kind={row.status} />
                          </div>
                          <p className="text-c-body font-bold">{row.title}</p>
                          {row.facts.length > 0 && (
                            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                              {row.facts.map((fact) => (
                                <div key={`${row.id}-${fact.key}-${fact.value}`} className="flex gap-1">
                                  <dt className="text-c-meta text-ink-mute">{t(FACT_LABEL[fact.key] ?? "timeline.fact.source")}</dt>
                                  <dd className="text-c-meta min-w-0 break-words">{fact.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          <p className="mt-1 text-c-meta text-ink-soft">
                            {t(`timeline.source.${row.source}` as StringKey)}
                          </p>
                          {row.confirmed && (
                            <p className="text-c-meta text-ink-soft">
                              {t("timeline.trail.confirmed", {
                                who: row.confirmed.name
                                  ? `${row.confirmed.name} (${t(`timeline.trail.role.${row.confirmed.by}`)})`
                                  : t(`timeline.trail.role.${row.confirmed.by}`),
                                time: clockTime(row.confirmed.at, "es"),
                                device: row.confirmed.device ? ` · ${row.confirmed.device}` : "",
                              })}
                            </p>
                          )}
                          {row.consent && (
                            <p className="text-c-meta text-ink-soft">
                              {t("timeline.trail.consent", {
                                time: clockTime(row.consent.at, "es"),
                                device: row.consent.device ? ` · ${row.consent.device}` : "",
                              })}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}

          {rows.some((r) => r.group === "alerta") && (
            <div className="mt-4">
              <FenceNotice />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
