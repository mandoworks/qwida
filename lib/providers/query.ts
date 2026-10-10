import { normalize } from "./search";

/**
 * The caregiver types into one box ("Escriba un nombre"), so the API has to
 * decide how to turn that single string into the MedSeek PR parameters, which
 * split first name from last name. Upstream also accepts one `q` that matches
 * either field, which is what rescues surnames typed first and compound names.
 *
 * These are pure so the fallback order can be tested without a network call.
 * The live bugs this fixes, all reproduced against production on Oct 9:
 *   - "Gerardo Alayon" was split into nombre=Gerardo, apellidos=Alayon, which
 *     upstream missed (his surname is ALAYON ANTA), so the route silently fell
 *     back to the 192 record local catalog and showed unrelated doctors.
 *   - `q=Alayon` returned all 741 records: upstream ignored `q` for that shape,
 *     we took the unfiltered list as a match.
 */

export type NameQuery = {
  /** What the caregiver typed, if anything. */
  raw?: string | null;
  /** Explicit first name, when the caller has one. */
  nombre?: string | null;
  /** Explicit last name, when the caller has one. */
  apellidos?: string | null;
};

export type MedSeekAttempt = {
  nombre?: string;
  apellidos?: string;
  q?: string;
};

/**
 * Attempts in priority order. The first is the most precise and the last is
 * the least filtered, so a caller can stop at the first non-empty result and
 * still end up with something sane.
 */
export function medseekAttempts(query: NameQuery): MedSeekAttempt[] {
  const nombre = query.nombre?.trim() ?? "";
  const apellidos = query.apellidos?.trim() ?? "";
  const raw = query.raw?.trim() ?? "";
  const attempts: MedSeekAttempt[] = [];

  /**
   * The UI has one box, so `nombre` often arrives holding the whole name. Split
   * it the same way `raw` is split, otherwise the attempt above is skipped and
   * the surname never reaches upstream.
   */
  const explicitParts = nombre && !apellidos ? nombre.trim().split(/\s+/).filter(Boolean) : [];
  const usableNombre = explicitParts.length > 1 ? explicitParts[0] : nombre;
  const usableApellidos = explicitParts.length > 1 ? explicitParts.slice(1).join(" ") : apellidos;

  if (usableNombre && usableApellidos) {
    attempts.push({ nombre: usableNombre, apellidos: usableApellidos });
  }

  const words = raw.split(/\s+/).filter(Boolean);

  if (!usableNombre && !usableApellidos && words.length >= 2) {
    // "Gerardo Alayon" -> nombre=Gerardo, apellidos=Alayon.
    attempts.push({ nombre: words[0], apellidos: words.slice(1).join(" ") });
  }

  // One `q` against the whole name. This is the attempt that finds compound
  // surnames, which the split above cannot produce.
  if (raw) attempts.push({ q: raw });

  // A single word is still a surname search, not a first name search. The
  // broad `q` above already covered the whole word, so only the first name
  // shape is left to try.
  if (!usableNombre && !usableApellidos && words.length === 1) {
    attempts.push({ nombre: words[0] });
  }

  if (!raw && (usableNombre || usableApellidos)) {
    attempts.push({ nombre: usableNombre || undefined, apellidos: usableApellidos || undefined });
  }

  // Last resort so the specialty and town filters still return the directory
  // rather than nothing, but only when the caregiver asked for no name at all.
  if (attempts.length === 0) attempts.push({});

  return attempts;
}

/**
 * Upstream ignores a filter it cannot match and returns the unfiltered list, so
 * a non-empty response is not evidence that the query worked. Keep only rows
 * that actually satisfy what the caregiver typed.
 */
export function narrowToQuery<T extends { name: string; specialty: string; municipio: string }>(
  rows: readonly T[],
  query: { specialty?: string | null; municipio?: string | null; raw?: string | null; nombre?: string | null; apellidos?: string | null },
): T[] {
  const allText = [query.raw, query.nombre, query.apellidos].filter(Boolean).join(" ");
  const terms = Array.from(new Set(allText.split(/\s+/).map((v) => normalize(v)).filter(Boolean)));
  const specialty = normalize(query.specialty ?? "");
  const municipio = normalize(query.municipio ?? "");

  return rows.filter((row) => {
    if (specialty && !normalize(row.specialty).includes(specialty)) return false;
    if (municipio && normalize(row.municipio) !== municipio) return false;
    if (terms.length === 0) return true;
    const haystack = normalize(row.name);
    return terms.every((term) => haystack.includes(term));
  });
}