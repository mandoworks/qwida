import { ScreenShell } from "@/components/patient/ScreenShell";
import { VoiceNote } from "@/components/patient/VoiceNote";

export default function HablarPage() {
  return (
    <ScreenShell title="Hablar con Marisol">
      <VoiceNote />
    </ScreenShell>
  );
}
