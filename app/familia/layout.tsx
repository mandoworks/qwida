import type { ReactNode } from "react";
import { CaregiverShell } from "@/components/caregiver/Shell";

export default function FamiliaLayout({ children }: { children: ReactNode }) {
  return <CaregiverShell>{children}</CaregiverShell>;
}
