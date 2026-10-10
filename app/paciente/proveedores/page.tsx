import type { Metadata } from "next";
import { ScreenShell } from "@/components/patient/ScreenShell";
import { ProviderDirectory } from "@/components/patient/ProviderDirectory";

export const metadata: Metadata = {
  title: "Buscar doctores | Qwida",
  description: "Busque doctores en Puerto Rico por especialidad y pueblo.",
};

export default function PacienteProveedoresPage() {
  return (
    <ScreenShell title="Buscar doctores">
      <ProviderDirectory />
    </ScreenShell>
  );
}
