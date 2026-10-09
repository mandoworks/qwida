import type { Provider } from "./catalog";

/** Lowercase, without accents, trimmed. "CARDIOLOGIA" and "Cardiología" compare equal. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Certification terms the caregiver can filter on, with the label she reads.
 * ORCPS sends a comma separated free text list (no taxonomy), so a term is
 * matched as a substring of the raw string.
 */
export const SPECIALTIES = [
  { value: "cardiologia", label: "Cardiología" },
  { value: "cardiologia intervencional", label: "Cardiología intervencional" },
  { value: "cardiologia pediatrica", label: "Cardiología pediátrica" },
  { value: "enfermedades cardiovasculares", label: "Enfermedades cardiovasculares" },
  { value: "medicina interna", label: "Medicina interna" },
  { value: "pediatria", label: "Pediatría" },
] as const;

export type ProviderQuery = {
  /** Substring of the certification list, accent insensitive. Empty or null means every specialty. */
  specialty?: string | null;
  /** Exact municipio of work. Empty or null means every municipio. */
  municipio?: string | null;
};

export function matchesSpecialty(provider: Provider, specialty: string): boolean {
  return normalize(provider.specialty).includes(normalize(specialty));
}

export function matchesMunicipio(provider: Provider, municipio: string): boolean {
  return normalize(provider.municipio) === normalize(municipio);
}

/** Pure filter. No sorting, no side effects: the order the file ships in is the order shown. */
export function searchProviders(providers: readonly Provider[], query: ProviderQuery = {}): Provider[] {
  const specialty = query.specialty?.trim() ?? "";
  const municipio = query.municipio?.trim() ?? "";
  return providers.filter(
    (p) =>
      (!specialty || matchesSpecialty(p, specialty)) && (!municipio || matchesMunicipio(p, municipio)),
  );
}

/** Municipios present in the data, so the filter never offers a town with nothing in it. */
export function municipios(providers: readonly Provider[]): string[] {
  return [...new Set(providers.map((p) => p.municipio))].sort((a, b) => a.localeCompare(b));
}
