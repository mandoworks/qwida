import { z } from "zod";
import humacaoData from "@/data/protocols/humacao-endoscopia.json";
import menonitaData from "@/data/protocols/menonita-mri-contraste.json";
import genericoData from "@/data/protocols/generico-especialista.json";

export const ProtocolRequirementSchema = z.object({
  category: z.string(),
  title: z.string(),
  description: z.string(),
  critical: z.boolean(),
});

export const ProtocolCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  procedure: z.string(),
  facility: z.string(),
  municipio: z.string(),
  summary: z.string(),
  warning_notice: z.string(),
  source_url: z.string().nullable(),
  fetched_at: z.string(),
  is_simulated: z.boolean(),
  badge_label: z.string(),
  simulated_notice: z.string().optional(),
  requirements: z.array(ProtocolRequirementSchema),
});

export type ProtocolRequirement = z.infer<typeof ProtocolRequirementSchema>;
export type ProtocolCardData = z.infer<typeof ProtocolCardSchema>;

/**
 * Fixed line under every simulated card. Those requirements mention holding or
 * stopping a medicine, and Qwida never tells a patient to start, stop, skip,
 * raise or lower one on its own: only her own doctor says so.
 */
export const MEDICATION_CAUTION =
  "No empiece, no suspenda y no cambie ninguna medicina sin hablar antes con su médico.";

export const PROTOCOL_CATALOG: ProtocolCardData[] = [
  ProtocolCardSchema.parse(humacaoData),
  ProtocolCardSchema.parse(menonitaData),
  ProtocolCardSchema.parse(genericoData),
];

export function getAllProtocols(): ProtocolCardData[] {
  return PROTOCOL_CATALOG;
}

export function getProtocolById(id: string): ProtocolCardData | undefined {
  return PROTOCOL_CATALOG.find((p) => p.id === id);
}

export function searchProtocols(query: string): ProtocolCardData[] {
  const q = query.trim().toLowerCase();
  if (!q) return PROTOCOL_CATALOG;
  return PROTOCOL_CATALOG.filter((p) => {
    const haystack = `${p.title} ${p.procedure} ${p.facility} ${p.municipio} ${p.summary}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * How many cards are an illustrative example rather than a published facility
 * rule. The count is read from the data, never typed in, so a card that is
 * relabelled SIMULADO cannot leave the page claiming otherwise.
 */
export function simulatedCount(protocols: readonly ProtocolCardData[] = PROTOCOL_CATALOG): number {
  return protocols.filter((p) => p.is_simulated).length;
}
