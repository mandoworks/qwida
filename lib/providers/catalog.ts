import { z } from "zod";
import cardiologia from "@/data/providers/cardiologia.json";
import endocrinologia from "@/data/providers/endocrinologia.json";
import medicinaInterna from "@/data/providers/medicina-interna.json";
import neurologia from "@/data/providers/neurologia.json";

/**
 * Real public licensing records for Puerto Rico, frozen at build time.
 * Nothing is fetched at runtime: the page has to work when ORCPS is down.
 * Source: Junta de Licenciamiento y Disciplina Médica (ORCPS), phone joined
 * from the CMS NPPES registry. One file per specialty, merged here and
 * deduped on license number because a doctor can hold several
 * certifications (for example cardiología and medicina interna).
 * See `scripts/fetch-orcps.mjs` for the refresh job.
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
  address: z.string().nullable().optional(),
  npi: z.string().nullable().optional(),
});
export type Provider = z.infer<typeof ProviderRecord>;

const ProviderFile = z.object({
  attribution: z.string().min(1),
  fetched_at: z.string().min(1),
  record_count: z.number().int().nonnegative(),
  notes: z.array(z.string()),
  records: z.array(ProviderRecord),
});

const ProviderCatalog = z
  .object({
    attribution: z.string().min(1),
    fetched_at: z.string().min(1),
    record_count: z.number().int().nonnegative(),
    municipio_counts: z.record(z.string(), z.number().int().nonnegative()),
    phone_count: z.number().int().nonnegative(),
    notes: z.array(z.string()),
    records: z.array(ProviderRecord),
  })
  .refine((c) => c.records.every((r) => r.license_status === "ACTIVO"), {
    message: "Solo se publican licencias activas.",
  });
export type ProviderCatalog = z.infer<typeof ProviderCatalog>;

const files = [
  ProviderFile.parse(cardiologia),
  ProviderFile.parse(neurologia),
  ProviderFile.parse(medicinaInterna),
  ProviderFile.parse(endocrinologia),
];

const seen = new Map<string, Provider>();
for (const file of files) {
  for (const record of file.records) {
    if (!seen.has(record.license_number)) seen.set(record.license_number, record);
  }
}

const records = [...seen.values()].sort(
  (a, b) =>
    a.municipio.localeCompare(b.municipio) ||
    a.name.localeCompare(b.name) ||
    a.license_number.localeCompare(b.license_number),
);

const municipio_counts: Record<string, number> = {};
for (const record of records) {
  municipio_counts[record.municipio] = (municipio_counts[record.municipio] ?? 0) + 1;
}

const parsed = ProviderCatalog.parse({
  attribution: files[0].attribution,
  fetched_at: files[0].fetched_at,
  record_count: records.length,
  municipio_counts,
  phone_count: records.filter((r) => r.phone !== null).length,
  notes: files[0].notes,
  records,
});

export const catalog: ProviderCatalog = parsed;
export const providers: Provider[] = parsed.records;

/** Where a caregiver checks a license number herself. Public ORCPS verification page. */
export const VERIFY_URL = "https://orcps.salud.pr.gov/mbps/verificacion";
