import type { Provider } from "./catalog";
import { readable } from "./format";

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

/** A row of a filter select. `count` is how many records she would be left with. */
export type FilterOption = { value: string; label: string; count: number };

/** The "no filter" row. Empty string, because that is what a native select can hold. */
export const NO_FILTER = "";

/**
 * Specialty rows with the count each one leaves, given the other filter.
 * The count is what makes a filter that cannot narrow honest: this catalog is
 * one specialty in one municipality, so "Cardiología" and "Ponce" both show
 * the full count instead of silently doing nothing.
 */
export function specialtyOptions(providers: readonly Provider[], query: ProviderQuery = {}): FilterOption[] {
  const rows = (specialty: string) => ({
    value: specialty,
    label: specialty ? (specialtyLabel(specialty) ?? readable(specialty)) : "Todas",
    count: searchProviders(providers, { ...query, specialty }).length,
  });
  return [rows(NO_FILTER), ...SPECIALTIES.map((s) => rows(s.value))];
}

/** Municipio rows with the count each one leaves, given the other filter. */
export function municipioOptions(providers: readonly Provider[], query: ProviderQuery = {}): FilterOption[] {
  const rows = (municipio: string) => ({
    value: municipio,
    label: municipio ? readable(municipio) : "Todos",
    count: searchProviders(providers, { ...query, municipio }).length,
  });
  return [rows(NO_FILTER), ...municipios(providers).map(rows)];
}

function specialtyLabel(value: string): string | undefined {
  return SPECIALTIES.find((s) => s.value === value.trim().toLowerCase())?.label;
}

/**
 * "Especialidad: Cardiología intervencional. Municipio: Ponce." Empty when no
 * filter is set, so the page only speaks about the filters when there are some.
 */
export function activeFilters(query: ProviderQuery): string {
  const specialty = query.specialty?.trim() ?? "";
  const municipio = query.municipio?.trim() ?? "";
  const parts: string[] = [];
  if (specialty) parts.push(`Especialidad: ${specialtyLabel(specialty) ?? readable(specialty)}`);
  if (municipio) parts.push(`Municipio: ${readable(municipio)}`);
  return parts.length ? `${parts.join(". ")}.` : "";
}
