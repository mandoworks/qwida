import Link from "next/link";
import { CardView } from "@/components/patient/CardView";
import { ScreenShell } from "@/components/patient/ScreenShell";

export default function TarjetaPage() {
  return (
    <ScreenShell title="Mi tarjeta">
      <CardView />
      <Link href="/paciente/medicinas" className="py-3 text-center text-p-label text-accent underline underline-offset-4">
        Ver mis medicinas
      </Link>
    </ScreenShell>
  );
}
