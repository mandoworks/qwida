"use client";

import type { ReactNode } from "react";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { t, type Lang } from "@/lib/weekcard/strings";
import { LangContext } from "./lang-context";

const STORAGE_KEY = "quida.cuidador.lang";

/** Wraps the caregiver side so every screen reads the same language. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useLocalValue(STORAGE_KEY);
  const lang: Lang = saved === "en" ? "en" : "es";
  const setLang = (next: Lang) => setSaved(next);
  return (
    <LangContext.Provider value={{ lang, setLang, t: (key, values) => t(lang, key, values) }}>
      {children}
    </LangContext.Provider>
  );
}
