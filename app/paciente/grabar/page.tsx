import { VisitRecorder } from "@/components/capture/VisitRecorder";
import { ScreenShell } from "@/components/patient/ScreenShell";

export default function GrabarPage() {
  return (
    <ScreenShell title="Grabar mi cita">
      <VisitRecorder />
    </ScreenShell>
  );
}
