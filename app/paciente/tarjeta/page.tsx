import { CardView } from "@/components/patient/CardView";
import { ScreenShell } from "@/components/patient/ScreenShell";
import { BigButton } from "@/components/ui/BigButton";

export default function TarjetaPage() {
  return (
    <ScreenShell title="Mi tarjeta">
      <CardView />
      <BigButton href="/paciente/medicinas" variant="secondary">
        Mis medicinas
      </BigButton>
    </ScreenShell>
  );
}
