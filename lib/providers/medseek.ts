import { z } from "zod";
import type { Provider } from "./catalog";

export const MEDSEEK_BASE_URL = "https://medseekpr.com/api";

export const MedSeekRawProvider = z.object({
  nombre: z.string(),
  inicial: z.string().nullable().optional(),
  apellidos: z.string(),
  especialidad: z.string(),
  npi: z.string().nullable().optional(),
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
  const licenseNumber = raw.npi || raw.source_id || "NPI-PENDIENTE";

  return {
    name: fullName || "Médico Especialista",
    specialty: raw.especialidad || "Medicina General",
    municipio: raw.pueblo || "Puerto Rico",
    license_number: licenseNumber,
    license_status: "ACTIVO",
    phone: raw.telefono && raw.telefono.trim().length > 0 ? raw.telefono.trim() : null,
    source_url: `https://medseekpr.com/directorio.html?categoria=MEDICOS&pueblo=${encodeURIComponent(raw.pueblo || "")}`,
    fetched_at: fetchedAt,
    address: fullAddress || null,
    npi: raw.npi || null,
  };
}

export type MedSeekSearchParams = {
  categoria?: string;
  especialidad?: string | null;
  pueblo?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
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
  url.searchParams.set("categoria", params.categoria || "MEDICOS");
  if (params.especialidad) url.searchParams.set("especialidad", params.especialidad);
  if (params.pueblo) url.searchParams.set("pueblo", params.pueblo);
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
