import { PhotoCapture } from "@/components/photo/PhotoCapture";
import { ScreenShell } from "@/components/patient/ScreenShell";
import { HOUSEHOLD_ID } from "@/lib/seed";

export default function FotoPage() {
  return (
    <ScreenShell title="Foto">
      <PhotoCapture householdId={HOUSEHOLD_ID} />
    </ScreenShell>
  );
}
