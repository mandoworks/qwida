"use client";

import { useMemo, useState } from "react";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { useClock } from "@/components/caregiver/clock";
import { providers, type Provider } from "@/lib/providers/catalog";
import { formatConsulted } from "@/lib/providers/format";
import { activeReferido, expiryLine, nudgeEvent } from "@/lib/providers/referido";
import { NO_FILTER, activeFilters, municipioOptions, searchProviders, specialtyOptions } from "@/lib/providers/search";
import { ProviderCard } from "./ProviderCard";

const SELECT = "min-h-14 rounded-xl border-2 border-ink-soft bg-surface px-3 text-lg";
const CLEAR = "self-start rounded-xl border-2 border-ink-soft bg-surface px-4 py-2 text-base font-bold underline";

/**
 * Search over the frozen ORCPS catalog. Filters are client state over static
 * data: no request, no key, no rate limit. Each row carries its own count, so
 * a filter that cannot narrow this catalog says so instead of looking broken.
 * The call reminder appears only when a referred specialist referral has been
 * confirmed by a person, and one tap writes it as a `nudge` event Marisol can
 * read on her side.
 */
export function ProviderSearch() {
  const [specialty, setSpecialty] = useState(NO_FILTER);
  const [municipio, setMunicipio] = useState(NO_FILTER);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { events } = useEvents();

  const results = useMemo(() => searchProviders(providers, { specialty, municipio }), [specialty, municipio]);
  const specialties = useMemo(() => specialtyOptions(providers, { municipio }), [municipio]);
  const towns = useMemo(() => municipioOptions(providers, { specialty }), [specialty]);
  const filtering = useMemo(() => activeFilters({ specialty, municipio }), [specialty, municipio]);
  const referral = useMemo(() => activeReferido(events), [events]);
  // No clock read while prerendering: the expiry line appears once mounted.
  const now = useClock();
  const expiry = referral && now !== null ? expiryLine(referral.expiresOn, todayPR(new Date(now))) : null;

  async function send(provider: Provider) {
    if (!referral) return;
    setBusy(provider.license_number);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nudgeEvent(provider, referral.expiresOn)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent((prev) => ({ ...prev, [provider.license_number]: true }));
    } catch {
      setError("No se pudo guardar el recordatorio. Intente otra vez.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Buscar profesionales de la salud" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="filtro-especialidad" className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Especialidad</span>
          <select
            id="filtro-especialidad"
            className={SELECT}
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            {specialties.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.count})
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="filtro-municipio" className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Municipio</span>
          <select
            id="filtro-municipio"
            className={SELECT}
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
          >
            {towns.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} ({t.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" className="text-lg">
        Mostrando {results.length} de {providers.length} profesionales con licencia activa.
      </p>

      {filtering && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg">
            Filtros activos: <span className="font-bold">{filtering}</span>
          </p>
          <button
            type="button"
            className={CLEAR}
            onClick={() => {
              setSpecialty(NO_FILTER);
              setMunicipio(NO_FILTER);
            }}
          >
            Quitar filtros
          </button>
        </div>
      )}

      {!referral && (
        <p role="note" className="rounded-2xl border-2 border-ink-soft bg-surface p-4 text-lg">
          Todavía no hay un referido confirmado en Quida. Cuando confirme la foto del referido, cada tarjeta
          mostrará la fecha de vencimiento y el botón para usarlo.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-surface p-4 text-lg text-danger">
          {error}
        </p>
      )}

      {results.length === 0 ? (
        <p className="text-lg">
          No hay profesionales con esa especialidad y ese municipio en estos datos. Quite los filtros para ver los{" "}
          {providers.length}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((provider) => (
            <li key={provider.license_number}>
              <ProviderCard
                provider={provider}
                consultedOn={formatConsulted(provider.fetched_at)}
                expiry={expiry}
                sent={sent[provider.license_number] === true}
                busy={busy === provider.license_number}
                onUseReferido={referral ? () => send(provider) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
