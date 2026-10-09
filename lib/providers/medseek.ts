import { z } from "zod";
import type { Provider } from "./catalog";

export const MEDSEEK_BASE_URL = "https://medseekpr.com/api";

export const MedSeekRawProvider = z.object({
  nombre: z.string(),
  inicial: z.string().nullable().optional(),
  apellidos: z.string(),
  especialidad: z.string(),
  npi: z.union([z.string(), z.number()]).nullish(),
  direccion_trabajo: z.string().nullable().optional(),
  pueblo: z.string(),
  estado: z.string().nullable().optional(),
  codigo_postal: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  data_source: z.string().nullable().optional(),
  source_id: z.string().nullable().optional(),
  has_scheduling: z.number().nullable().optional(),
  sort_order: z.number().nullable().optional(),
});

export type MedSeekRawProvider = z.infer<typeof MedSeekRawProvider>;

export function mapMedSeekToProvider(raw: MedSeekRawProvider, fetchedAt = new Date().toISOString()): Provider {
  const parts = [raw.nombre, raw.inicial, raw.apellidos].filter(Boolean);
  const fullName = parts.join(" ").trim();
  const addressParts = [raw.direccion_trabajo, raw.pueblo, raw.estado ? raw.estado : "PR", raw.codigo_postal].filter(Boolean);
  const fullAddress = addressParts.join(", ");
  const npiStr = raw.npi !== null && raw.npi !== undefined ? String(raw.npi) : null;
  const licenseNumber = npiStr || raw.source_id || "NPI-PENDIENTE";
  const directNpiUrl = npiStr ? `https://medseekpr.com/p/${npiStr}` : null;
  const searchUrl = `https://medseekpr.com/directorio.html?categoria=MEDICOS&pueblo=${encodeURIComponent(raw.pueblo || "")}`;

  return {
    name: fullName || "Médico Especialista",
    specialty: raw.especialidad || "Medicina General",
    municipio: raw.pueblo || "Puerto Rico",
    license_number: licenseNumber,
    license_status: "ACTIVO",
    phone: raw.telefono && raw.telefono.trim().length > 0 ? raw.telefono.trim() : null,
    source_url: directNpiUrl || searchUrl,
    fetched_at: fetchedAt,
    address: fullAddress || null,
    npi: npiStr,
  };
}

const SPECIALTY_MAP: Record<string, string> = {
  "cardiólogo": "CARDIOLOGIA",
  "cardiologo": "CARDIOLOGIA",
  "cardiología": "CARDIOLOGIA",
  "cardiologia": "CARDIOLOGIA",
  "geriatra": "GERIATRIA",
  "geriatría": "GERIATRIA",
  "geriatria": "GERIATRIA",
  "neurólogo": "NEUROLOGIA",
  "neurologo": "NEUROLOGIA",
  "neurología": "NEUROLOGIA",
  "neurologia": "NEUROLOGIA",
  "oftalmólogo": "OFTALMOLOGIA",
  "oftalmologo": "OFTALMOLOGIA",
  "oftalmología": "OFTALMOLOGIA",
  "oftalmologia": "OFTALMOLOGIA",
  "endocrinólogo": "ENDOCRINOLOGIA",
  "endocrinologo": "ENDOCRINOLOGIA",
  "endocrinología": "ENDOCRINOLOGIA",
  "endocrinologia": "ENDOCRINOLOGIA",
  "internista": "MEDICINA INTERNA",
  "médico internista": "MEDICINA INTERNA",
  "medico internista": "MEDICINA INTERNA",
  "generalista": "GENERALISTA",
  "médico general": "GENERALISTA",
  "medico general": "GENERALISTA",
  "médico de familia": "MEDICINA DE FAMILIA",
  "medico de familia": "MEDICINA DE FAMILIA",
  "psiquiatra": "PSIQUIATRIA",
  "psiquiatría": "PSIQUIATRIA",
  "psiquiatria": "PSIQUIATRIA",
  "psicólogo": "PSICOLOGIA",
  "psicologo": "PSICOLOGIA",
  "psicología": "PSICOLOGIA",
  "psicologia": "PSICOLOGIA",
  "nefrólogo": "NEFROLOGIA",
  "nefrologo": "NEFROLOGIA",
  "nefrología": "NEFROLOGIA",
  "nefrologia": "NEFROLOGIA",
  "neumólogo": "NEUMOLOGIA",
  "neumologo": "NEUMOLOGIA",
  "neumología": "NEUMOLOGIA",
  "neumologia": "NEUMOLOGIA",
  "ortopeda": "ORTOPEDIA",
  "ortopedia": "ORTOPEDIA",
  "reumatólogo": "REUMATOLOGIA",
  "reumatologo": "REUMATOLOGIA",
  "reumatología": "REUMATOLOGIA",
  "reumatologia": "REUMATOLOGIA",
  "fisiatra": "MEDICINA FISICA REHABILITACION",
  "pediatra": "PEDIATRIA",
  "pediatría": "PEDIATRIA",
  "pediatria": "PEDIATRIA",
};

export function normalizeMedSeekSpecialty(spec: string): string {
  const clean = spec.toLowerCase().trim();
  return SPECIALTY_MAP[clean] || spec.toUpperCase().trim();
}

export type MedSeekSearchParams = {
  categoria?: string;
  especialidad?: string | null;
  pueblo?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  q?: string | null;
  limit?: number;
};

/**
 * Live search against medseekpr.com API.
 * Returns array of normalized Provider objects.
 */
export async function searchMedSeek(
  params: MedSeekSearchParams = {},
  fetchOptions?: { timeoutMs?: number }
): Promise<Provider[]> {
  const url = new URL(`${MEDSEEK_BASE_URL}/search`);
  if (params.categoria) url.searchParams.set("categoria", params.categoria);
  url.searchParams.set("limit", String(params.limit || 1000));
  if (params.especialidad) {
    url.searchParams.set("especialidad", normalizeMedSeekSpecialty(params.especialidad));
  }
  if (params.pueblo) url.searchParams.set("pueblo", params.pueblo.trim().toUpperCase());
  if (params.q) url.searchParams.set("q", params.q);
  if (params.nombre) url.searchParams.set("nombre", params.nombre);
  if (params.apellidos) url.searchParams.set("apellidos", params.apellidos);

  const timeoutMs = fetchOptions?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`MedSeek PR responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const now = new Date().toISOString();
    return data
      .map((item) => {
        const parsed = MedSeekRawProvider.safeParse(item);
        return parsed.success ? mapMedSeekToProvider(parsed.data, now) : null;
      })
      .filter((p): p is Provider => p !== null);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch all available municipalities from medseekpr.com.
 */
export async function fetchMedSeekPueblos(timeoutMs = 4000): Promise<string[]> {
  const url = `${MEDSEEK_BASE_URL}/pueblos?categoria=MEDICOS`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => (typeof item === "string" ? item : item.pueblo))
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch all specialties from medseekpr.com.
 */
export async function fetchMedSeekSpecialties(timeoutMs = 4000): Promise<string[]> {
  const url = `${MEDSEEK_BASE_URL}/specialties?categoria=MEDICOS`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => (typeof item === "string" ? item : item.especialidad))
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  } finally {
    clearTimeout(timer);
  }
}

export type MedSeekProfileResult = {
  success: boolean;
  is_verified?: boolean;
  accepting_new_patients?: boolean | null;
  accepts_plan_vital?: boolean | null;
  accepts_medicare?: boolean | null;
  telemedicina?: boolean | null;
  horarios?: string | null;
  full_address?: string | null;
  idiomas?: string[];
};

/**
 * Fetch detailed provider availability, plan acceptance, and hours from medseekpr.com.
 */
export async function fetchMedSeekProfile(
  nombre: string,
  apellidos: string,
  timeoutMs = 4000
): Promise<MedSeekProfileResult | null> {
  const url = new URL(`${MEDSEEK_BASE_URL}/provider-profile`);
  url.searchParams.set("nombre", nombre);
  url.searchParams.set("apellidos", apellidos);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.success) return null;

    return {
      success: true,
      is_verified: data.is_verified ?? false,
      accepting_new_patients: data.availability?.accepting_new_patients ?? null,
      accepts_plan_vital: data.availability?.accepts_plan_vital ?? null,
      accepts_medicare: data.availability?.accepts_medicare ?? null,
      telemedicina: data.availability?.telemedicina ?? null,
      horarios: data.location?.horarios ?? null,
      full_address: data.location?.full_address ?? null,
      idiomas: Array.isArray(data.idiomas) ? data.idiomas : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

