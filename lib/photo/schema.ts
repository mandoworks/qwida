import { z } from "zod";
import type { FenceResult } from "@/lib/fence";
import type { QuidaEvent } from "@/lib/store/types";

export const PHOTO_CLASSES = ["rx_handwritten", "rx_label", "referido", "appointment_slip", "other"] as const;
export const PhotoClass = z.enum(PHOTO_CLASSES);
export type PhotoClass = z.infer<typeof PhotoClass>;

const confidence = z
  .number()
  .describe("How sure you are that value is exactly what is written, from 0 to 1. Use below 0.5 for anything hard to read.");
const sourceText = z
  .string()
  .describe("The exact characters read from the image for this field, or '[ilegible]' if they cannot be read.");

function field<T extends z.ZodType>(value: T, describe: string) {
  return z.object({ value: value.nullable().describe(describe), confidence, source_text: sourceText });
}
const text = (d: string) => field(z.string(), d);
const num = (d: string) => field(z.number(), d);

/** A handwritten prescription or a printed pharmacy label. Every field carries what was read. */
export const PrescriptionFields = z.object({
  drug: text("Medicine name, e.g. 'losartán'. Null if it cannot be read."),
  strength: text("Strength with unit, e.g. '50 mg'."),
  dose: text("Amount per dose as written, e.g. '1 tableta'."),
  frequency: text("How often, in the words on the paper, e.g. 'una vez al día'."),
  times_per_day: num("Doses per day as a whole number, only if clearly stated."),
  quantity: num("Number of units dispensed or prescribed, e.g. 30."),
  refills: num("Number of refills allowed."),
  prescriber: text("Prescribing doctor's name."),
  pharmacy: text("Pharmacy name. Null on a handwritten prescription."),
  rx_number: text("Prescription number printed on the label."),
  date: text("Fill date on a label or date written on the prescription, as YYYY-MM-DD."),
});
export type PrescriptionFields = z.infer<typeof PrescriptionFields>;

/** A referido slip. `expires_on` is not here: code computes it, never the model. */
export const ReferidoFields = z.object({
  specialty: text("Specialty referred to, e.g. 'cardiología'."),
  issue_date: text("Date the referido was issued, as YYYY-MM-DD."),
  referring_doctor: text("Name of the doctor who wrote the referido."),
  plan: text("Health plan name on the slip."),
});
export type ReferidoFields = z.infer<typeof ReferidoFields>;

/** What the vision model must return for one photo. */
export const PhotoExtraction = z.object({
  class: PhotoClass.describe(
    "rx_handwritten: prescription written by hand. rx_label: printed pharmacy label on a bottle or bag. " +
      "referido: referral slip to a specialist. appointment_slip: appointment card or slip. other: anything else.",
  ),
  prescription: PrescriptionFields.nullable().describe("Only for rx_handwritten or rx_label, else null."),
  referido: ReferidoFields.nullable().describe("Only for referido, else null."),
  unreadable_lines: z
    .array(z.string())
    .describe("Short Spanish notes for every line or part that could not be read, e.g. 'Línea 3: indicaciones ilegibles'."),
});
export type PhotoExtraction = z.infer<typeof PhotoExtraction>;

export type Field = { value: string | number | null; confidence: number; source_text: string };

/** A field after the deterministic trust rules ran. */
export type TrustedField = Field & {
  /** Confidence at or above the threshold on a printed label: show it filled in. */
  prefill: boolean;
  /** Low confidence, missing, or disagrees with the visit: a person must look. */
  highlight: boolean;
  /** Set when the visit recording says something different. Both values are shown. */
  mismatch?: { visit: string; note: string };
};
export type TrustedFields = Record<string, TrustedField>;

/** Response body of POST /api/photo. */
export type PhotoResponse = {
  simulated: boolean;
  class: PhotoClass;
  trusted: boolean;
  badge: string | null;
  fields: TrustedFields | null;
  expires_on: string | null;
  unreadable_lines: string[];
  fence: FenceResult;
  /** Spanish line for the person when nothing usable was found. */
  message: string | null;
  events: QuidaEvent[];
};

/** Body of POST /api/photo/confirm. `values` holds what the person edited, keyed by field name. */
export const ConfirmBody = z.object({
  eventId: z.string().min(1),
  householdId: z.string().min(1).optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  confirmedBy: z.enum(["patient", "familia"]).default("familia"),
});
export type ConfirmBody = z.input<typeof ConfirmBody>;
