import { z } from "zod";
import type { FenceResult } from "@/lib/fence";
import type { QuidaEvent } from "@/lib/store/types";

const quote = z
  .string()
  .describe("Exact words from the transcript that support this item, copied verbatim.");

const needsConfirmation = z
  .boolean()
  .describe("True when any field is null, unclear, or could have been misheard.");

export const HeardPrescription = z.object({
  drug: z.string().nullable().describe("Medicine name as heard. Null if not clearly said."),
  dose: z.string().nullable().describe("Dose as heard, e.g. '20 mg'. Null if not clearly said."),
  frequency: z
    .string()
    .nullable()
    .describe("How often, in the doctor's words, e.g. 'una en la noche'. Null if not said."),
  needs_confirmation: needsConfirmation,
  source_quote: quote,
});

export const HeardReferido = z.object({
  specialty: z.string().nullable().describe("Specialty referred to, e.g. 'endocrinología'."),
  needs_confirmation: needsConfirmation,
  source_quote: quote,
});

export const HeardAppointment = z.object({
  date_text: z.string().nullable().describe("When, exactly as said, e.g. 'en tres meses'."),
  resolved_date: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD only if the exact calendar date was said. Otherwise null."),
  needs_confirmation: needsConfirmation,
  source_quote: quote,
});

/** What the model must return for a visit transcript. Strict: no extra keys. */
export const VisitExtraction = z.object({
  prescriptions: z.array(HeardPrescription).describe("New prescriptions the doctor gave."),
  referidos: z.array(HeardReferido).describe("Referrals to a specialist."),
  next_appointment: HeardAppointment.nullable().describe("Next follow up visit, if mentioned."),
  questions_back: z
    .array(z.string())
    .describe(
      "Short questions in Spanish (usted) to ask the family for every null or unclear field.",
    ),
});

export type HeardPrescription = z.infer<typeof HeardPrescription>;
export type HeardReferido = z.infer<typeof HeardReferido>;
export type HeardAppointment = z.infer<typeof HeardAppointment>;
export type VisitExtraction = z.infer<typeof VisitExtraction>;

/** Response body of POST /api/visit. */
export type VisitResponse = {
  simulated: boolean;
  transcript: string;
  fence: FenceResult;
  extraction: VisitExtraction;
  events: QuidaEvent[];
};
