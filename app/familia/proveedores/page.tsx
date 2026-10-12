"use client";

import { ProviderDirectory } from "@/components/patient/ProviderDirectory";
import { useAdvanced } from "@/components/caregiver/advanced-context";

export default function FamiliaProveedoresPage() {
  const { advanced } = useAdvanced();
  return <ProviderDirectory compact={!advanced} />;
}
