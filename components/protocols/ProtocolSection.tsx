"use client";

import { useState } from "react";
import { ProtocolCard } from "@/components/protocols/ProtocolCard";
import { getAllProtocols, searchProtocols, simulatedCount } from "@/lib/protocols/catalog";

export function ProtocolSection() {
  const [query, setQuery] = useState("");
  const all = getAllProtocols();
  const protocols = query ? searchProtocols(query) : all;
  const simulated = simulatedCount(all);

  return (
    <section aria-labelledby="protocolos-heading" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h3 id="protocolos-heading" className="text-2xl font-bold">
          Protocolos de visita
        </h3>
        <p className="text-lg text-ink-soft leading-relaxed">
          Muchos pacientes llegan a su cita o estudio médico y pierden el viaje por no
          cumplir requisitos previos. Revise estas guías antes de salir de casa.
        </p>
        <p className="rounded-2xl border-2 border-warn bg-surface p-4 text-lg">
          En esta lista, <span className="font-bold">{simulated} de {all.length}</span> son ejemplos
          simulados. No son la norma de una instalación real. Cada tarjeta lo dice por su cuenta.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor="protocol-filter" className="text-base font-bold">
          Buscar por procedimiento o pueblo:
        </label>
        <input
          id="protocol-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ejemplo: endoscopía, resonancia, cardiología..."
          className="rounded-xl border-2 border-line bg-surface p-3 text-lg focus:border-ink focus:outline-hidden"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {protocols.map((p) => (
          <ProtocolCard key={p.id} protocol={p} />
        ))}
      </div>

      {protocols.length === 0 && (
        <p className="rounded-xl border-2 border-line p-6 text-center text-lg text-ink-soft">
          No se encontraron protocolos con ese término de búsqueda.
        </p>
      )}
    </section>
  );
}
