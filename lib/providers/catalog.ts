import { z } from "zod";
import raw from "@/data/providers/cardiologia-ponce.json";

/**
 * Real public licensing records for Puerto Rico, frozen at build time.
 * Nothing is fetched at runtime: the page has to work when ORCPS is down.
 * Source: Junta de Licenciamiento y Disciplina Médica (ORCPS), phone joined
 * from the CMS NPPES registry. See `data/providers/cardiologia-ponce.json`.
 */

export const ProviderRecord = z.object({
  name: z.string().min(1),
  /** Free text list of certifications as ORCPS sends it, uppercase, not normalized. */
  specialty: z.string().min(1),
  /** Municipio where the professional works. */
  municipio: z.string().min(1),
  license_number: z.string().min(1),
  license_status: z.string().min(1),
  /** Practice phone published in NPPES, or null when the join found nothing. */
  phone: z.string().min(1).nullable(),
  source_url: z.string().min(1),
  fetched_at: z.string().min(1),
});
export type Provider = z.infer<typeof ProviderRecord>;

const ProviderCatalog = z
  .object({
    specialty: z.string().min(1),
    region: z.string().min(1),
    attribution: z.string().min(1),
    fetched_at: z.string().min(1),
    record_count: z.number().int().nonnegative(),
    notes: z.array(z.string()),
    records: z.array(ProviderRecord),
  })
  .refine((c) => c.records.every((r) => r.license_status === "ACTIVO"), {
    message: "Solo se publican licencias activas.",
  });
export type ProviderCatalog = z.infer<typeof ProviderCatalog>;

const parsed = ProviderCatalog.parse(raw);

export const catalog: ProviderCatalog = parsed;
export const providers: Provider[] = parsed.records;

/** Where a caregiver checks a license number herself. Public ORCPS verification page. */
export const VERIFY_URL = "https://orcps.salud.pr.gov/mbps/verificacion";
