import { checkFence } from "@/lib/fence";
import { CARD_ICONS, type CardItem, type WeekCard } from "./schema";

/** Longest line Doña Carmen reads on one card. Keeps the patient side readable. */
export const MAX_CARD_ITEMS = 7;
export const MAX_CARD_QUESTIONS = 3;

export type StrippedCard = {
  card: WeekCard;
  /** Text that was dropped because it read as medication change advice. */
  removed: string[];
  /** True when any text read as an emergency, so the UI shows the 911 banner. */
  emergency: boolean;
};

/**
 * Runs the Fence on every line of the card, whatever produced it (model,
 * fixture or a family member edit) and drops anything that reads as advice to
 * start, stop, skip, raise or lower a medication. Emergency words are reported,
 * never silently sent.
 */
export function stripMedAdvice(input: WeekCard): StrippedCard {
  const removed: string[] = [];
  let emergency = false;

  const safeItem = (item: CardItem): CardItem | null => {
    const text = checkFence(`${item.day} ${item.time ?? ""} ${item.text}`);
    if (text.emergency) emergency = true;
    if (text.medChange) {
      removed.push(item.text);
      return null;
    }
    return { ...item, icon: CARD_ICONS.includes(item.icon as (typeof CARD_ICONS)[number]) ? item.icon : undefined };
  };

  const items = input.items.map(safeItem).filter((i): i is CardItem => i !== null);
  const questionsForDoctor: string[] = [];
  for (const q of input.questionsForDoctor) {
    const text = checkFence(q);
    if (text.emergency) emergency = true;
    if (text.medChange) {
      removed.push(q);
      continue;
    }
    questionsForDoctor.push(q);
  }

  return {
    card: {
      ...input,
      items: items.slice(0, MAX_CARD_ITEMS),
      questionsForDoctor: questionsForDoctor.slice(0, MAX_CARD_QUESTIONS),
    },
    removed,
    emergency,
  };
}

/** Text a family member must not be able to save: empty lines, whatever the source. */
export function normalizeCard(input: WeekCard): WeekCard {
  return {
    ...input,
    title: input.title.trim() || "Mi tarjeta de la semana",
    items: input.items
      .map((i) => ({ ...i, day: i.day.trim(), text: i.text.trim(), time: i.time?.trim() || undefined }))
      .filter((i) => i.day !== "" && i.text !== ""),
    questionsForDoctor: input.questionsForDoctor.map((q) => q.trim()).filter((q) => q !== ""),
  };
}

/** Card plus everything the UI needs to explain what the Fence did. */
export function cleanCard(input: WeekCard): StrippedCard {
  return stripMedAdvice(normalizeCard(input));
}
