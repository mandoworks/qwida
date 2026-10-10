import type { VisitExtraction } from "./schema";

/**
 * SIMULADO fixture used when no AI key is configured or a provider fails.
 * It matches public/demo/visita-1.mp3 line for line, so the fallback shows
 * what the demo clip says. Synthetic role played visit; everything is fictional.
 */
export const FIXTURE_TRANSCRIPT = [
  "Doctor: Bueno, doña Carmen, vamos a mantener el losartán de 50 miligramos, una pastilla al día, por la mañana.",
  "Paciente: Muy bien, doctor. Me la he estado tomando con el café por la mañana.",
  "Doctor: Perfecto. Le voy a dar un referido para cardiología, para que le evalúen esa presión con más calma.",
  "Paciente: Está bien, doctor. Mi hija Marisol se encarga de llamar para sacar la cita del cardiólogo.",
  "Doctor: Excelente. Y para el estómago, le voy a recetar algo, un omeprazol, en ayunas.",
  "Paciente: Entendido, en ayunas antes de desayunar.",
  "Doctor: La semana antes de volver, hágase una hemoglobina glucosilada, en ayunas. Y si se le hinchan los pies, me llama enseguida.",
  "Paciente: Ay, sí, doctor. Yo le aviso.",
  "Doctor: Y nos vemos otra vez en tres semanas, más o menos. Cuídese mucho.",
  "Paciente: Muchísimas gracias, doctor. Que pase buen día y que Dios me lo bendiga.",
].join("\n");

export const FIXTURE_EXTRACTION: VisitExtraction = {
  prescriptions: [
    {
      drug: "omeprazol",
      dose: null,
      frequency: "en ayunas",
      needs_confirmation: true,
      source_quote: "Y para el estómago, le voy a recetar algo, un omeprazol, en ayunas.",
    },
  ],
  referidos: [
    {
      specialty: "cardiología",
      needs_confirmation: false,
      source_quote: "Le voy a dar un referido para cardiología, para que le evalúen esa presión con más calma.",
    },
  ],
  labs: [
    {
      test: "hemoglobina glucosilada",
      timing_text: "la semana antes de volver",
      fasting: true,
      needs_confirmation: false,
      source_quote: "La semana antes de volver, hágase una hemoglobina glucosilada, en ayunas.",
    },
  ],
  doctor_notes: [
    {
      topic: "Hinchazón de pies",
      source_quote: "Y si se le hinchan los pies, me llama enseguida.",
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
