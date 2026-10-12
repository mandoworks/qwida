"use client";

import type { ReactNode } from "react";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { AdvancedContext } from "./advanced-context";

const STORAGE_KEY = "quida.cuidador.vistaAvanzada";

/** Wraps the caregiver side so every screen shares one Vista avanzada toggle. */
export function AdvancedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useLocalValue(STORAGE_KEY);
  const advanced = saved === "1";
  const setAdvanced = (v: boolean) => setSaved(v ? "1" : "0");
  return (
    <AdvancedContext.Provider value={{ advanced, setAdvanced }}>
      {children}
    </AdvancedContext.Provider>
  );
}
