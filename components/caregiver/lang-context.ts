import { createContext, useContext } from "react";
import type { Lang, StringKey } from "@/lib/weekcard/strings";

export type LangValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, values?: Record<string, string | number>) => string;
};

/** Null until LangProvider wraps the tree, so a missing provider is loud. */
export const LangContext = createContext<LangValue | null>(null);

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error("LangProvider is missing around the caregiver side");
  return value;
}
