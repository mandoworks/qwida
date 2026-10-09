import type { VisitExtraction } from "./schema";

/**
 * SIMULADO fixture used when no AI Gateway key is configured. Synthetic
 * role played visit; the doctor and every detail are fictional.
 */
export const FIXTURE_TRANSCRIPT = [
  "Doctor: Buenos días, doña Carmen. ¿Cómo ha estado de la presión?",
  "Paciente: Más o menos, doctor. A veces me mareo por la mañana.",
  "Doctor: Vamos a empezar losartán de 50 miligramos, una pastilla al día, por la mañana.",
  "Doctor: También le voy a recetar algo para el estómago, un omeprazol, en ayunas.",
  "Doctor: Le voy a dar un referido para cardiología, para que le miren el corazón.",
  "Doctor: Y nos vemos otra vez en tres semanas, más o menos.",
  "Paciente: Gracias, doctor. Mi hija Marisol va a llamar para la cita.",
].join("\n");

export const FIXTURE_EXTRACTION: VisitExtraction = {
  prescriptions: [
    {
      drug: "losartán",
      dose: "50 mg",
      frequency: "una pastilla al día, por la mañana",
      needs_confirmation: false,
      source_quote: "Vamos a empezar losartán de 50 miligramos, una pastilla al día, por la mañana.",
    },
    {
      drug: "omeprazol",
      dose: null,
      frequency: "en ayunas",
      needs_confirmation: true,
      source_quote: "un omeprazol, en ayunas.",
    },
  ],
  referidos: [
    {
      specialty: "cardiología",
      needs_confirmation: false,
      source_quote: "Le voy a dar un referido para cardiología, para que le miren el corazón.",
    },
  ],
  next_appointment: {
    date_text: "en tres semanas, más o menos",
    resolved_date: null,
    needs_confirmation: true,
    source_quote: "Y nos vemos otra vez en tres semanas, más o menos.",
  },
  questions_back: [
    "¿Qué dosis de omeprazol le recetó el médico? Mírela en la etiqueta de la farmacia.",
    "¿Qué día exacto es la próxima cita? Confírmelo con la oficina del médico.",
  ],
};
