"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useEvents } from "@/lib/client/useEvents";
import { longDate } from "@/lib/weekcard/format";
import { filterRows, timelineRows, type TimelineGroup } from "@/lib/weekcard/timeline";
import type { StringKey } from "@/lib/weekcard/strings";
import { useLang } from "./lang-context";

const GROUPS: { id: TimelineGroup | "all"; key: StringKey }[] = [
  { id: "all", key: "timeline.filter.all" },
  { id: "cita", key: "timeline.filter.cita" },
  { id: "receta", key: "timeline.filter.receta" },
  { id: "referido", key: "timeline.filter.referido" },
  { id: "nota", key: "timeline.filter.nota" },
  { id: "alerta", key: "timeline.filter.alerta" },
];

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
};

/** Everything medical in order, filtered by type and by specialty text. */
export function Timeline() {
  const { events } = useEvents();
  const { t, lang } = useLang();
  const [group, setGroup] = useState<TimelineGroup | "all">("all");
  const [specialty, setSpecialty] = useState("");

  const rows = filterRows(timelineRows(events), group, specialty);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-3xl font-bold">{t("timeline.title")}</h2>

      <section aria-label={t("timeline.filter.type")} className="flex flex-col gap-2">
        <span className="font-bold">{t("timeline.filter.type")}</span>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              aria-pressed={group === g.id}
              className={`min-h-11 rounded-xl border-2 px-4 font-bold ${
                group === g.id ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
              }`}
            >
              {t(g.key)}
            </button>
          ))}
        </div>
      </section>

      <label className="flex flex-col gap-1">
        <span className="font-bold">{t("timeline.filter.specialty")}</span>
        <input
          type="search"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="cardiología"
          className="min-h-12 rounded-xl border-2 border-ink bg-surface px-3"
        />
      </label>

      {rows.length === 0 ? (
        <p className="rounded-2xl border-2 border-line bg-surface px-5 py-6 text-ink-soft">{t("timeline.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border-2 border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="mr-auto text-xl font-bold">{row.title}</h3>
                <Badge kind={row.status} />
              </div>
              {row.facts.length > 0 && (
                <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                  {row.facts.map((fact) => (
                    <div key={`${row.id}-${fact.key}-${fact.value}`} className="flex gap-2">
                      <dt className="text-ink-soft">{t(FACT_LABEL[fact.key] ?? "timeline.fact.source")}</dt>
                      <dd className="min-w-0 break-words">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-2 text-ink-soft">{longDate(row.at, lang)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
