import { BigButton } from "@/components/ui/BigButton";
import { VERIFY_URL, type Provider } from "@/lib/providers/catalog";
import { readable } from "@/lib/providers/format";

const CAREGIVER_BUTTON = "min-h-0 py-3 text-xl";

type ProviderCardProps = {
  provider: Provider;
  /** "9 de octubre de 2026", the day the registry was read. */
  /** Referral deadline line, only when a confirmed referral exists. */
  expiry: string | null;
  /** True once this caregiver created the call reminder from this card. */
  sent: boolean;
  busy?: boolean;
  onUseReferido?: () => void;
};

/**
 * One licensed professional. Everything on it is public record: name,
 * certifications as ORCPS sends them, municipio of work, license number, the
 * date the registry was read, and the practice phone when NPPES published one.
 * The two questions Qwida cannot answer stay on screen as answered questions.
 */
export function ProviderCard({ provider, expiry, sent, busy, onUseReferido }: ProviderCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-4 text-lg">
      <header className="flex flex-col gap-1">
        <h3 className="text-2xl font-bold">{readable(provider.name)}</h3>
        <p className="text-ink-soft">{readable(provider.specialty)}</p>
        <p className="font-bold">{readable(provider.municipio)}</p>
      </header>


      <p>
        {provider.phone ? (
          <>
            Teléfono de la consulta:{" "}
            <a href={`tel:${provider.phone}`} className="font-bold underline">
              {provider.phone}
            </a>
          </>
        ) : (
          <span className="text-ink-soft">No hay teléfono público para este profesional.</span>
        )}
      </p>

      {provider.address && (
        <p className="text-base text-ink-soft">
          <span className="font-bold text-ink">Dirección:</span> {provider.address}
        </p>
      )}

      <ul className="flex flex-col gap-2 text-base">
        <li className="w-fit rounded-full border-2 border-ink-soft px-4 py-2">
          <span className="font-bold">¿Acepta pacientes nuevos?</span>{" "}
          {provider.accepts_new_patients === true
            ? "Según MedSeek PR: sí · Llame para confirmar"
            : provider.accepts_new_patients === false
              ? "Según MedSeek PR: no · Llame para confirmar"
              : "No hay datos públicos"}
        </li>
        <li className="w-fit rounded-full border-2 border-ink-soft px-4 py-2">
          <span className="font-bold">¿Acepta su plan?</span>{" "}
          {provider.accepts_plan_vital === true
            ? "Según MedSeek PR: sí · Llame para confirmar"
            : provider.accepts_plan_vital === false
              ? "Según MedSeek PR: no · Llame para confirmar"
              : "Llame para confirmar"}
        </li>
        {provider.telemedicina && (
          <li className="w-fit rounded-full border-2 border-ok px-4 py-2 font-bold text-ok">
            Ofrece telemedicina
          </li>
        )}
      </ul>

      <p>
        <a href={VERIFY_URL} target="_blank" rel="noreferrer noopener" className="font-bold underline">
          Verificar licencia
        </a>{" "}
        <span className="text-base text-ink-soft">(se abre en otra pestaña)</span>
      </p>

      {provider.npi && (
        <p>
          <a
            href={`https://medseekpr.com/p/${provider.npi}`}
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold underline text-ink"
          >
            Ver perfil en MedSeek (medseekpr.com/p/{provider.npi})
          </a>
        </p>
      )}

      {expiry && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-warn p-4">
          <p className="font-bold">{expiry}</p>
          {sent ? (
            <p role="status" className="font-bold text-ok">
              Recordatorio guardado. Llámele usted.
            </p>
          ) : (
            onUseReferido && (
              <BigButton variant="secondary" className={CAREGIVER_BUTTON} onClick={onUseReferido} disabled={busy}>
                {busy ? "Guardando…" : "Usar con mi referido"}
              </BigButton>
            )
          )}
        </div>
      )}
    </article>
  );
}
