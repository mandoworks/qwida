"use client";

import { useMemo, useState } from "react";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { providers, type Provider } from "@/lib/providers/catalog";
import { formatConsulted, readable } from "@/lib/providers/format";
import { activeReferido, expiryLine, nudgeEvent } from "@/lib/providers/referido";
import { SPECIALTIES, municipios, searchProviders } from "@/lib/providers/search";
import { ProviderCard } from "./ProviderCard";

const TODAS = "";
const SELECT = "min-h-14 rounded-xl border-2 border-ink-soft bg-surface px-3 text-lg";

/**
 * Search over the frozen ORCPS catalog. Filters are client state over static
 * data: no request, no key, no rate limit. The call reminder appears only when
 * a referred specialist referral has been confirmed by a person, and one tap
 * writes it as a `nudge` event Marisol can read on her side.
 */
export function ProviderSearch() {
  const [specialty, setSpecialty] = useState(TODAS);
  const [municipio, setMunicipio] = useState(TODAS);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { events } = useEvents();

  const results = useMemo(() => searchProviders(providers, { specialty, municipio }), [specialty, municipio]);
  const towns = useMemo(() => municipios(providers), []);
  const referral = useMemo(() => activeReferido(events), [events]);
  const expiry = referral ? expiryLine(referral.expiresOn, todayPR()) : null;

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
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Especialidad</span>
          <select className={SELECT} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value={TODAS}>Todas</option>
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Municipio</span>
          <select className={SELECT} value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
            <option value={TODAS}>Todos</option>
            {towns.map((t) => (
              <option key={t} value={t}>
                {readable(t)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" className="text-lg">
        Mostrando {results.length} de {providers.length} profesionales con licencia activa.
      </p>

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
        <p className="text-lg">No hay profesionales con esa especialidad en estos datos.</p>
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
