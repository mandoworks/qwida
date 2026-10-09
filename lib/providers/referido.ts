import { daysBetween, formatDia, isIsoDate } from "@/lib/photo/dates";
import { HOUSEHOLD_ID } from "@/lib/seed";
import type { NewEvent, QuidaEvent } from "@/lib/store/types";
import type { Provider } from "./catalog";
import { readable } from "./format";

/**
 * A Plan Vital referral is valid 90 days from the day it was issued.
 * ASES Carta Normativa 23-0117-03, quoted verbatim in the source document:
 * "*** Este documento es válido por 90 días a partir de la fecha de emisión del
 * proveedor que refiere."
 */
export const ASES_RULE = "Los referidos del Plan Vital vencen a los 90 días (ASES, Carta Normativa 23-0117-03)";

export type ActiveReferido = { expiresOn: string; specialty: string | null; eventId: string };

/**
 * The most recently issued CONFIRMADO referral. A draft referral has no
 * expiry yet, so it does not count: nothing reaches the family member side without
 * a person confirming it.
 */
export function activeReferido(events: readonly QuidaEvent[]): ActiveReferido | null {
  const withExpiry = events
    .filter((e) => e.kind === "referido" && e.status === "CONFIRMADO")
    .map((e) => ({ event: e, expiresOn: e.payload.expires_on }))
    .filter(
      (c): c is { event: QuidaEvent; expiresOn: string } =>
        typeof c.expiresOn === "string" && isIsoDate(c.expiresOn),
    )
    .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn));

  const latest = withExpiry[0];
  if (!latest) return null;
  const specialty = latest.event.payload.specialty;
  return {
    expiresOn: latest.expiresOn,
    specialty: typeof specialty === "string" ? specialty : null,
    eventId: latest.event.id,
  };
}

/** "Su referido vence el 7 de enero", said in past tense once the date has passed. */
export function expiryLine(expiresOn: string, today: string): string {
  const days = daysBetween(today, expiresOn);
  const when = formatDia(expiresOn);
  if (days < 0) return `Su referido ya venció el ${when}`;
  if (days === 0) return `Su referido vence hoy, ${when}`;
  return `Su referido vence el ${when}`;
}

/**
 * The body of the `nudge` event a family member creates with one tap. The wording
 * only asks for a call about a cita. It never says to take, skip, stop or
 * change a medication.
 */
export function nudgeEvent(provider: Provider, expiresOn: string): NewEvent {
  const text = `Llamar a ${readable(provider.name)} para cita antes del ${formatDia(expiresOn)}`;
  return {
    householdId: HOUSEHOLD_ID,
    kind: "nudge",
    // The family member tapped. This is not model output, so it is not a draft.
    status: "CONFIRMADO",
    source: "familia",
    confidence: 1,
    payload: {
      synthetic: false,
      public_record: true,
      text,
      doctor_name: provider.name,
      doctor_specialty: provider.specialty,
      doctor_municipio: provider.municipio,
      doctor_license: provider.license_number,
      doctor_phone: provider.phone,
      expires_on: expiresOn,
      ases_rule: ASES_RULE,
      source: `ORCPS + CMS NPPES, consultado el ${provider.fetched_at.slice(0, 10)}`,
      source_url: provider.source_url,
    },
  };
}
