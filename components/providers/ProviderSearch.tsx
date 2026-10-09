"use client";

import { useEffect, useMemo, useState } from "react";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { useClock } from "@/components/caregiver/clock";
import { providers, type Provider } from "@/lib/providers/catalog";
import { readable } from "@/lib/providers/format";
import { activeReferido, expiryLine, nudgeEvent } from "@/lib/providers/referido";
import {
  NO_FILTER,
  SPECIALTIES,
  activeFilters,
  municipioOptions,
  searchProviders,
  specialtyOptions,
} from "@/lib/providers/search";
import { ProviderCard } from "./ProviderCard";

const SELECT = "min-h-14 rounded-xl border-2 border-ink-soft bg-surface px-3 text-lg";
const INPUT = "min-h-14 rounded-xl border-2 border-ink-soft bg-surface px-3 text-lg";
const CLEAR = "self-start rounded-xl border-2 border-ink-soft bg-surface px-4 py-2 text-base font-bold underline";

export function ProviderSearch() {
  const [specialty, setSpecialty] = useState(NO_FILTER);
  const [municipio, setMunicipio] = useState(NO_FILTER);
  const [nameQuery, setNameQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<Provider[] | null>(null);
  const [source, setSource] = useState<string>("local");
  const [searching, setSearching] = useState(false);
  const [remotePueblos, setRemotePueblos] = useState<string[]>([]);
  const [remoteSpecialties, setRemoteSpecialties] = useState<string[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { events } = useEvents();

  // Load island-wide metadata (78 municipalities, specialty taxonomy) from MedSeek PR
  useEffect(() => {
    let active = true;
    fetch("/api/providers?meta=options")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.pueblos) && data.pueblos.length > 0) {
          setRemotePueblos(data.pueblos);
        }
        if (Array.isArray(data.specialties) && data.specialties.length > 0) {
          setRemoteSpecialties(data.specialties);
        }
      })
      .catch(() => {
        // Local catalog remains active on fetch failure
      });

    return () => {
      active = false;
    };
  }, []);

  const hasFilter = specialty !== NO_FILTER || municipio !== NO_FILTER || nameQuery.trim().length > 0;

  // Dynamic search: queries /api/providers (MedSeek PR live API) with debouncing,
  // falling back to local catalog filtering on error or empty query.
  useEffect(() => {
    const trimmedName = nameQuery.trim();
    if (!specialty && !municipio && !trimmedName) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (specialty) params.set("specialty", specialty);
        if (municipio) params.set("municipio", municipio);
        if (trimmedName) params.set("nombre", trimmedName);

        const res = await fetch(`/api/providers?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!active) return;

        if (data.ok && Array.isArray(data.providers) && data.providers.length > 0) {
          setRemoteResults(data.providers);
          setSource(data.source || "medseekpr.com");
        } else {
          setRemoteResults(null);
          setSource("local");
        }
      } catch {
        if (!active) return;
        setRemoteResults(null);
        setSource("local");
      } finally {
        if (active) setSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [specialty, municipio, nameQuery]);

  const results = useMemo(() => {
    if (!hasFilter) return providers;
    if (remoteResults !== null) return remoteResults;
    return searchProviders(providers, {
      specialty,
      municipio,
      name: nameQuery.trim() || undefined,
    });
  }, [hasFilter, remoteResults, specialty, municipio, nameQuery]);

  const townOptions = useMemo(() => {
    if (remotePueblos.length === 0) {
      return municipioOptions(providers, { specialty });
    }
    return [
      { value: NO_FILTER, label: "Todos", count: providers.length },
      ...remotePueblos.map((p) => ({
        value: p,
        label: readable(p),
        count: 0,
      })),
    ];
  }, [remotePueblos, specialty]);

  const specialtyList = useMemo(() => {
    if (remoteSpecialties.length === 0) {
      return specialtyOptions(providers, { municipio });
    }
    const knownValues = new Set(SPECIALTIES.map((s) => s.value.toLowerCase()));
    const extras = remoteSpecialties
      .filter((s) => !knownValues.has(s.toLowerCase()))
      .map((s) => ({ value: s, label: readable(s), count: 0 }));
    const base = specialtyOptions(providers, { municipio });
    return [...base, ...extras];
  }, [remoteSpecialties, municipio]);

  const filtering = useMemo(
    () => activeFilters({ specialty, municipio, name: nameQuery.trim() || undefined }),
    [specialty, municipio, nameQuery],
  );

  const referral = useMemo(() => activeReferido(events), [events]);
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
        body: JSON.stringify({ ...nudgeEvent(provider, referral.expiresOn), confirmedBy: "caregiver" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent((prev) => ({ ...prev, [provider.license_number]: true }));
    } catch {
      setError("No se pudo guardar el recordatorio. Intente otra vez.");
    } finally {
      setBusy(null);
    }
  }

  const totalBase = Math.max(results.length, providers.length);

  return (
    <section aria-label="Buscar profesionales de la salud" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <label htmlFor="filtro-nombre" className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Nombre o apellido</span>
          <input
            id="filtro-nombre"
            type="search"
            placeholder="Ej. Rivera, González, Pérez…"
            className={INPUT}
            value={nameQuery}
            onChange={(e) => {
              setNameQuery(e.target.value);
              setRemoteResults(null);
            }}
          />
        </label>
        <label htmlFor="filtro-especialidad" className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Especialidad</span>
          <select
            id="filtro-especialidad"
            className={SELECT}
            value={specialty}
            onChange={(e) => {
              setSpecialty(e.target.value);
              setRemoteResults(null);
            }}
          >
            {specialtyList.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} {s.count > 0 ? `(${s.count})` : ""}
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
            onChange={(e) => {
              setMunicipio(e.target.value);
              setRemoteResults(null);
            }}
          >
            {townOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} {t.count > 0 ? `(${t.count})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-lg">
          Mostrando {results.length} de {totalBase} profesionales.
        </p>

        <div className="flex items-center gap-2">
          {searching && (
            <span role="status" className="text-sm font-semibold text-ink-soft">
              Buscando en vivo…
            </span>
          )}
          {source === "medseekpr.com" && (
            <span className="rounded-full border-2 border-ok bg-surface px-3 py-1 text-sm font-bold text-ok">
              Directorio: MedSeek PR (78 municipios)
            </span>
          )}
          {source === "local" && (
            <span className="rounded-full border-2 border-ink-soft bg-surface px-3 py-1 text-sm font-bold text-ink-soft">
              Registro local ORCPS
            </span>
          )}
        </div>
      </div>

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
              setNameQuery("");
              setRemoteResults(null);
              setSource("local");
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

      {results.length === 0 && !searching ? (
        <p className="text-lg">
          No hay profesionales con esos criterios en estos datos. Quite los filtros para ver los {providers.length}{" "}
          del registro base o pruebe con otro municipio o apellido.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((provider) => (
            <li key={provider.license_number}>
              <ProviderCard
                provider={provider}
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
