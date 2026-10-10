import type { ConfirmedBy } from "@/lib/fence/gate";
import { HOUSEHOLDS } from "@/lib/seed/pack";

/** Who tapped, beyond the role: the person's name and the kind of device, both resolved on the server. */
export type Who = { name: string | null; device: string | null };

/** A short device label from the User-Agent, for the paper trail. Never the full string. */
export function deviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/iPhone/.test(userAgent)) return "iPhone";
  if (/iPad/.test(userAgent)) return "iPad";
  if (/Android/.test(userAgent)) return "Android";
  if (/CrOS/.test(userAgent)) return "Chromebook";
  if (/Macintosh|Mac OS X/.test(userAgent)) return "Mac";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Linux/.test(userAgent)) return "Linux";
  return null;
}

type Persona = { patient?: { display?: string; name?: string }; caregiver?: { name?: string } };

/** The name of the patient or the family member in a synthetic household, or null for any other household. */
export function personName(householdId: string, by: ConfirmedBy): string | null {
  const h = Object.values(HOUSEHOLDS).find((x) => x.householdId === householdId);
  const persona = h?.persona as Persona | undefined;
  if (!persona) return null;
  return (by === "patient" ? persona.patient?.display ?? persona.patient?.name : persona.caregiver?.name) ?? null;
}

export function whoFrom(request: Request, householdId: string, by: ConfirmedBy | undefined): Who {
  return {
    name: by ? personName(householdId, by) : null,
    device: deviceLabel(request.headers.get("user-agent")),
  };
}
