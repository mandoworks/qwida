"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useEvents } from "@/lib/client/useEvents";
import { daysBetween, todayPR } from "@/lib/photo/dates";
import { activeReferido } from "@/lib/providers/referido";
import { useLocalValue } from "./useLocalValue";

/**
 * Visit prep inside Mi Tarjeta, mirroring the family dashboard's Tarjeta
 * Médica tab: next-appointment card, Antes de su cita checklist, Preguntas
 * para el doctor with add-a-question, refills due, 90-day referral countdown.
 * Usted form, patient type tokens, Yari card language. Synthetic demo data.
 */

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Usted form, matching the family tab's four items. */
const CHECKLIST = [
  "Lleve su lista actual de medicamentos.",
  "Lleve sus resultados de laboratorio recientes.",
  "Lleve su tarjeta del plan médico.",
  "Lleve una identificación con foto.",
] as const;

/** Starter questions, first person: she asks them herself. */
const STARTER_QUESTIONS = [
  "¿Necesito cambiar la hora de alguno de mis medicamentos?",
  "¿Qué señales debo vigilar antes de la próxima visita?",
] as const;

type Appointment = {
  specialty: string;
  doctor: string;
  place: string;
  date: string;
  time: string;
};

function nextAppointment(events: ReturnType<typeof useEvents>["events"]): Appointment | null {
  const today = todayPR();
  const upcoming = events
    .filter((e) => e.kind === "appointment" && e.status === "CONFIRMADO")
    .map((e) => {
      const p = e.payload as Record<string, unknown>;
      const rawDate = typeof p.date === "string" ? p.date : "";
      return {
        specialty: typeof p.specialty === "string" ? p.specialty : "su cita",
        doctor: typeof p.doctor === "string" ? p.doctor : "",
        place: typeof p.place === "string" ? p.place : "",
        date: rawDate.slice(0, 10),
        time: rawDate.slice(11, 16),
      };
    })
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return upcoming[0] ?? null;
}

/** Deterministic synthetic refill estimate, stable across renders. */
function refillDays(drug: string): number {
  let h = 0;
  for (let i = 0; i < drug.length; i++) h = (h * 31 + drug.charCodeAt(i)) % 20;
  return 5 + h;
}

function formatHora(time: string): string {
  if (!time) return "";
  const [hh, mm] = time.split(":").map(Number);
  if (isNaN(hh)) return time;
  const suffix = hh >= 12 ? "p. m." : "a. m.";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function VisitPrep() {
  const { events } = useEvents();
  const today = useSyncExternalStore(() => () => {}, () => todayPR(), () => "1970-01-01");
  const [checked, setChecked] = useLocalValue("quida.visitChecklist");
  const [extraQuestionsRaw, setExtraQuestionsRaw] = useLocalValue("quida.doctorQuestions");
  const [draft, setDraft] = useState("");

  const appointment = useMemo(() => nextAppointment(events), [events]);
  const referido = useMemo(() => activeReferido(events), [events]);

  const done = useMemo(() => new Set((checked ?? "").split("|").filter(Boolean)), [checked]);
  const toggle = (item: string) => {
    const next = new Set(done);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setChecked([...next].join("|"));
  };

  const extraQuestions = useMemo(
    () => (extraQuestionsRaw ?? "").split("|").map((q) => q.trim()).filter(Boolean),
    [extraQuestionsRaw]
  );
  const questions = [...STARTER_QUESTIONS, ...extraQuestions];
  const addQuestion = () => {
    const q = draft.trim().slice(0, 140);
    if (!q) return;
    setExtraQuestionsRaw([...extraQuestions, q].join("|"));
    setDraft("");
  };

  const meds = useMemo(
    () =>
      events
        .filter((e) => e.kind === "med_schedule" && e.status === "CONFIRMADO")
        .map((e) => {
          const p = e.payload as Record<string, unknown>;
          const drug = typeof p.drug === "string" ? p.drug : "";
          const dose = typeof p.dose === "string" ? p.dose : "";
          return { drug, dose, days: refillDays(drug) };
        })
        .filter((m) => m.drug),
    [events]
  );

  const apptDate = appointment ? appointment.date.split("-").map(Number) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Next appointment */}
      <article className="yari-card bg-card-appointment p-6" aria-labelledby="vp-cita-titulo">
        {appointment && apptDate ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="vp-date-block" aria-hidden="true">
                <span>{MESES[apptDate[1] - 1]}</span>
                <strong>{apptDate[2]}</strong>
                <span>{apptDate[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="vp-ribbon">PRÓXIMA CITA</p>
                <h3 id="vp-cita-titulo" className="yari-headline text-p-title font-bold capitalize">
                  {appointment.specialty}
                </h3>
                <p className="mt-1 text-p-body text-ink-soft">Su visita de seguimiento.</p>
              </div>
            </div>
            <dl className="mt-5 flex flex-col gap-3">
              {appointment.time && (
                <div className="flex gap-4 text-p-body">
                  <dt className="w-20 shrink-0 font-bold text-ink-soft">Hora</dt>
                  <dd className="font-bold text-ink">{formatHora(appointment.time)}</dd>
                </div>
              )}
              {appointment.doctor && (
                <div className="flex gap-4 text-p-body">
                  <dt className="w-20 shrink-0 font-bold text-ink-soft">Doctor</dt>
                  <dd className="text-ink">{appointment.doctor.replace(" (ficticia)", "")}</dd>
                </div>
              )}
              {appointment.place && (
                <div className="flex gap-4 text-p-body">
                  <dt className="w-20 shrink-0 font-bold text-ink-soft">Lugar</dt>
                  <dd className="text-ink">{appointment.place.replace(" (ficticio)", "")}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <p role="status" className="text-p-body">
            Todavía no hay una cita programada.
          </p>
        )}
        <p className="mt-4 text-p-meta text-ink-mute">Datos de ejemplo (SIMULADO).</p>
      </article>

      {/* Before your visit */}
      <article className="yari-card bg-surface p-6" aria-labelledby="vp-antes-titulo">
        <h3 id="vp-antes-titulo" className="yari-headline text-p-subtitle font-bold">
          Antes de su cita
        </h3>
        <p className="mt-1 text-p-body font-bold text-ink-soft">Prepare estas cuatro cosas.</p>
        <ul className="mt-4 flex flex-col gap-3">
          {CHECKLIST.map((item) => {
            const isDone = done.has(item);
            return (
              <li key={item}>
                <label className="vp-check">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggle(item)}
                    className="vp-checkbox"
                  />
                  <span className={isDone ? "text-ink-mute line-through" : ""}>{item}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </article>

      {/* Questions for the doctor */}
      <article className="yari-card bg-surface p-6" aria-labelledby="vp-preguntas-titulo">
        <h3 id="vp-preguntas-titulo" className="yari-headline text-p-subtitle font-bold">
          Preguntas para el doctor
        </h3>
        <ol className="vp-questions">
          {questions.map((q, i) => (
            <li key={`${i}-${q}`}>{q}</li>
          ))}
        </ol>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            addQuestion();
          }}
        >
          <label htmlFor="vp-nueva-pregunta" className="text-p-body font-bold text-ink">
            Añada otra pregunta
          </label>
          <input
            id="vp-nueva-pregunta"
            type="text"
            value={draft}
            maxLength={140}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escriba su pregunta"
            className="min-h-[4rem] rounded-2xl border-[3px] border-ink bg-cream px-5 text-p-body text-ink placeholder:text-ink-mute"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="min-h-[4rem] rounded-2xl border-[3px] border-ink bg-accent px-6 text-p-body font-bold text-accent-ink shadow-yari-btn transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Añadir pregunta
          </button>
        </form>
        <p className="mt-3 text-p-meta text-ink-mute">
          Las preguntas añadidas aquí se guardan en este teléfono.
        </p>
      </article>

      {/* Refills */}
      <article className="yari-card vp-refills p-6" aria-labelledby="vp-recargas-titulo">
        <h3 id="vp-recargas-titulo" className="yari-headline text-p-subtitle font-bold">
          Medicamentos por renovar
        </h3>
        {meds.length === 0 ? (
          <p role="status" className="mt-3 text-p-body">
            Todavía no hay medicinas confirmadas.
          </p>
        ) : (
          <ul className="mt-2">
            {meds.map((m) => (
              <li key={`${m.drug}-${m.dose}`} className="vp-refill-item">
                <strong className="block text-p-body capitalize">{m.drug}</strong>
                <span className="text-p-body text-ink-soft">Renovar en {m.days} días</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-p-meta text-ink-mute">Datos de ejemplo (SIMULADO).</p>
      </article>

      {/* Referral countdown */}
      <article className="yari-card vp-referral p-6" aria-labelledby="vp-referido-titulo">
        <h3 id="vp-referido-titulo" className="yari-headline text-p-subtitle font-bold">
          Referido médico
        </h3>
        {referido ? (
          <>
            <div className="vp-countdown">
              <strong>{daysBetween(today, referido.expiresOn)}</strong>
              <span>días restantes</span>
            </div>
            <p className="text-p-body text-ink">
              El referido de 90 días vence el {referido.expiresOn.split("-")[2].replace(/^0/, "")}{" "}
              de {MESES_LARGO[Number(referido.expiresOn.split("-")[1]) - 1]} de{" "}
              {referido.expiresOn.split("-")[0]}.
            </p>
          </>
        ) : (
          <p role="status" className="text-p-body">
            No hay un referido activo ahora mismo.
          </p>
        )}
        <p className="mt-3 text-p-meta text-ink-mute">Datos de ejemplo (SIMULADO).</p>
      </article>
    </div>
  );
}
