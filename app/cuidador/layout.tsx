import type { ReactNode } from "react";
import { CaregiverShell } from "@/components/caregiver/Shell";

export default function CuidadorLayout({ children }: { children: ReactNode }) {
  return <CaregiverShell>{children}</CaregiverShell>;
}
