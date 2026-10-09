import { MedsView } from "@/components/patient/MedsView";
import { ScreenShell } from "@/components/patient/ScreenShell";

export default function MedicinasPage() {
  return (
    <ScreenShell title="Mis medicinas">
      <MedsView />
    </ScreenShell>
  );
}
