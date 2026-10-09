import { Badge } from "@/components/ui/Badge";
import type { ProtocolCardData } from "@/lib/protocols/catalog";

type ProtocolCardProps = {
  protocol: ProtocolCardData;
};

export function ProtocolCard({ protocol }: ProtocolCardProps) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-5 text-lg">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {protocol.procedure}
          </span>
          {protocol.is_simulated ? (
            <Badge kind="SIMULADO" />
          ) : (
            <span className="inline-flex items-center rounded-md border-2 border-ok bg-ok px-2 py-0.5 text-sm font-bold tracking-wide text-white">
              {protocol.badge_label}
            </span>
          )}
        </div>
        <h3 className="text-2xl font-bold">{protocol.title}</h3>
        <p className="font-semibold text-ink-soft">
          {protocol.facility} ({protocol.municipio})
        </p>
      </header>

      {/* Hero warning banner: No pierda el viaje */}
      <div className="rounded-xl border-2 border-warn bg-warn/10 p-4 text-base">
        <p className="font-bold text-warn mb-1">Aviso de preparación</p>
        <p className="text-ink font-medium leading-relaxed">{protocol.warning_notice}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className="text-lg font-bold">Requisitos previos obligatorios:</h4>
        <ul className="flex flex-col gap-3">
          {protocol.requirements.map((req, idx) => (
            <li
              key={idx}
              className={`rounded-xl border p-3.5 text-base ${
                req.critical
                  ? "border-warn/60 bg-surface shadow-xs"
                  : "border-line bg-surface/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-ink">{req.title}</span>
                {req.critical && (
                  <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-bold text-warn">
                    Crítico
                  </span>
                )}
              </div>
              <p className="text-ink-soft leading-normal">{req.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <footer className="mt-2 flex flex-col gap-1 border-t border-line pt-3 text-sm text-ink-soft">
        {protocol.source_url ? (
          <p>
            Fuente:{" "}
            <a
              href={protocol.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-bold underline text-ink"
            >
              Documento público oficial
            </a>{" "}
            (consultado el 9 de octubre de 2026).
          </p>
        ) : (
          <p className="text-warn font-semibold">
            {protocol.simulated_notice || "Protocolo de demostración con datos simulados."}
          </p>
        )}
      </footer>
    </article>
  );
}
