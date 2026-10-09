import { gateway, generateText, Output } from "ai";
import { z } from "zod";
import type { QuidaEvent } from "@/lib/store/types";
import { hasAiKey } from "@/lib/visit/pipeline";
import { confirmedFacts, buildFixtureCard } from "./fixture";
import { CARD_ICONS, type CardItem, type WeekCard } from "./schema";
import { cleanCard, type StrippedCard } from "./safety";

/** Vercel AI Gateway model string, same model the capture lane uses. */
export const DRAFT_MODEL = "anthropic/claude-sonnet-5.5";

const ModelItem = z.object({
  day: z.string(),
  time: z.string().nullish(),
  text: z.string(),
  icon: z.string().nullish(),
});

const ModelCard = z.object({
  title: z.string(),
  items: z.array(ModelItem),
  questionsForDoctor: z.array(z.string()),
});

const SYSTEM = `Escribes la tarjeta semanal de una familia en Puerto Rico. La lee Doña Carmen, 78 años, en su teléfono.
Reglas:
- Usa solo los datos CONFIRMADOS que te doy. No inventes fechas, dosis, médicos ni medicamentos.
- Cada línea es corta, en español Puerto Rico, tratando a Mamá de usted.
- Prohigido: nunca digas que empiece, deje, salte, suba o baje una medicina, ni que tome más o menos. Solo repita lo que ya está confirmado.
- El campo day es corto: "jueves 15 de octubre", "Todos los días" o "Esta semana".
- El campo time es opcional y solo si hay hora.
- El campo icon usa solo estos símbolos: ${CARD_ICONS.join(" ")}.
- Máximo 7 líneas y 2 o 3 preguntas para el doctor.`;

export type DraftResult = StrippedCard & { card: WeekCard; simulated: boolean };

/**
 * Draft for the week card. With an AI Gateway key the model writes it from the
 * confirmed facts; without a key, or when the call fails, the deterministic
 * fixture builds the same shape with plain rules and the card is labeled
 * SIMULADO. Either way the Fence runs on every line before it leaves here.
 */
export async function draftWeekCard(events: QuidaEvent[], today: string): Promise<DraftResult> {
  if (!hasAiKey()) return fixtureResult(events, today);

  const facts = confirmedFacts(events, today);
  try {
    const { output } = await generateText({
      model: gateway(DRAFT_MODEL),
      system: SYSTEM,
      prompt: `Fecha de hoy: ${today}\n\nDatos confirmados:\n${JSON.stringify(facts, null, 2)}`,
      output: Output.object({ schema: ModelCard }),
    });
    const items: CardItem[] = output.items.map((i) => ({
      day: i.day,
      time: i.time ?? undefined,
      text: i.text,
      icon: i.icon ?? undefined,
    }));
    const clean = cleanCard({ title: output.title, items, questionsForDoctor: output.questionsForDoctor });
    return { ...clean, simulated: false };
  } catch (err) {
    console.error("week card draft failed, using SIMULADO fixture", err);
    return fixtureResult(events, today);
  }
}

function fixtureResult(events: QuidaEvent[], today: string): DraftResult {
  const clean = cleanCard(buildFixtureCard(events, today));
  return { ...clean, simulated: true };
}
