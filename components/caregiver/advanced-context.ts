import { createContext, useContext } from "react";

export type AdvancedValue = {
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
};

/** Null until AdvancedProvider wraps the tree, so a missing provider is loud. */
export const AdvancedContext = createContext<AdvancedValue | null>(null);

export function useAdvanced(): AdvancedValue {
  const value = useContext(AdvancedContext);
  if (!value) throw new Error("AdvancedProvider is missing around the caregiver side");
  return value;
}
