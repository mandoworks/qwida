"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { activeReferido, expiryLine } from "@/lib/providers/referido";
import { ReferidoCountdown } from "@/components/photo/ReferidoCountdown";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
import { Loading } from "./Loading";
import { useFirstLoad } from "./useFirstLoad";

type Provider = {
  name: string;
  specialty: string;
  municipio: string;
  phone: string | null;
  address: string | null;
  license_status?: string;
};

/** Patient grade provider directory. Big controls, plain words, live
 *  MedSeek PR data with the local catalog as backup. Synthetic demo. */
export function ProviderDirectory() {
  const { events } = useEvents();
  const [specialty, setSpecialty] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [pueblos, setPueblos] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [results, setResults] = useState<Provider[] | null>(null);
  const [source, setSource] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useFirstLoad(true, null);

  const referido = useMemo(() => activeReferido(events), [events]);
  const today = useSyncExternalStore(() => () => {}, () => todayPR(), () => "1970-01-01");

  // Filter options from the live directory, with local backup already in the API.
  useEffect(() => {
    let active = true;
    fetch("/api/providers?meta=options")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.pueblos)) setPueblos(data.pueblos);
        if (Array.isArray(data.specialties)) setSpecialties(data.specialties);
        if (data.source) setSource(String(data.source));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Debounced search against /api/providers (MedSeek PR live, local fallback).
  useEffect(() => {
    const q = nameQuery.trim();
    if (!specialty && !municipio && !q) {
      setResults(null);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (specialty) params.set("especialidad", specialty);
        if (municipio) params.set("municipio", municipio);
        if (q) params.set("nombre", q);
        const res = await fetch(`/api/providers?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!active) return;
        if (data.ok && Array.isArray(data.providers)) {
          setResults(data.providers.slice(0, 20));
          setSource(data.source || "");
        } else {
          setResults([]);
        }
      } catch {
        if (!active) return;
        setError("No pudimos buscar ahora mismo. Intente otra vez.");
        setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [specialty, municipio, nameQuery]);

  const clear = () => {
    setSpecialty("");
    setMunicipio("");
    setNameQuery("");
    setResults(null);
  };
  const hasFilter = specialty !== "" || municipio !== "" || nameQuery.trim() !== "";

  const SELECT =
    "min-h-[4.5rem] w-full rounded-2xl border-[3px] border-ink bg-cream px-5 text-p-body font-bold text-ink";
  const LABEL = "text-p-body font-bold text-ink";

  return (
    <div className="flex flex-col gap-6">
      {!loaded && <Loading />}

      {/* Referral countdown on top */}
      {referido && (
        <section aria-label="Su referido" className="yari-card bg-surface p-6">
          <ReferidoCountdown
            specialty={referido.specialty}
            expiresOn={referido.expiresOn}
            today={today}
            size="patient"
          />
          <p className="mt-3 text-p-meta text-ink-mute">
            {expiryLine(referido.expiresOn, today)}. Datos de ejemplo (SIMULADO).
          </p>
        </section>
      )}

      {/* Search */}
      <section aria-labelledby="buscar-doctor" className="yari-card bg-surface p-6">
        <h2 id="buscar-doctor" className="yari-headline text-p-title font-bold">
          Buscar doctores
        </h2>
        <p className="mt-2 text-p-body text-ink-soft">
          Elija una especialidad y un pueblo para ver doctores.
        </p>

        <div className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="f-especialidad" className={LABEL}>
              Especialidad
            </label>
            <select
              id="f-especialidad"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className={SELECT}
            >
              <option value="">Todas las especialidades</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="f-pueblo" className={LABEL}>
              Pueblo
            </label>
            <select
              id="f-pueblo"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className={SELECT}
            >
              <option value="">Todo Puerto Rico</option>
              {pueblos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="f-nombre" className={LABEL}>
              Nombre del doctor (opcional)
            </label>
            <input
              id="f-nombre"
              type="search"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Escriba un nombre"
              className="min-h-[4.5rem] w-full rounded-2xl border-[3px] border-ink bg-cream px-5 text-p-body text-ink placeholder:text-ink-mute"
            />
          </div>

          {hasFilter && (
            <button
              type="button"
              onClick={clear}
              className="min-h-[3.5rem] self-start rounded-2xl border-[3px] border-ink-soft bg-surface px-6 text-p-body font-bold text-ink underline"
            >
              Borrar filtros
            </button>
          )}
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="resultados" aria-live="polite">
        <h2 id="resultados" className="yari-headline text-p-subtitle font-bold">
          {searching
            ? "Buscando…"
            : results === null
              ? "Elija filtros para empezar"
              : results.length === 0
                ? "Sin resultados"
                : `${results.length} ${results.length === 1 ? "doctor" : "doctores"}`}
        </h2>

        {error && (
          <p role="alert" className="yari-card mt-4 bg-danger-soft p-5 text-p-body font-bold text-danger">
            {error}
          </p>
        )}

        {results !== null && !searching && results.length > 0 && (
          <ul className="mt-4 flex flex-col gap-5">
            {results.map((p, i) => (
              <li key={`${p.name}-${i}`} className="yari-card bg-surface p-6">
                <p className="text-p-body font-bold text-ink">{p.name}</p>
                <p className="mt-1 text-p-body capitalize text-ink-soft">{p.specialty}</p>
                <p className="mt-1 text-p-body text-ink-soft">{p.municipio}</p>
                {p.phone && (
                  <a
                    href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}
                    className="mt-3 inline-block min-h-[3.5rem] rounded-2xl border-[3px] border-ink bg-accent px-6 py-2 text-p-body font-bold text-accent-ink"
                  >
                    Llamar: {p.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {source && results !== null && (
          <p className="mt-4 text-p-meta text-ink-mute">
            Datos de {source === "medseekpr.com" ? "MedSeek PR (medseekpr.com)" : "nuestro directorio local"}. Quida no recomienda doctores. Datos de ejemplo (SIMULADO).
          </p>
        )}
      </section>

      <SyntheticBanner />
    </div>
  );
}
