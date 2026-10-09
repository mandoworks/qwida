import type { ReactNode } from "react";
import { FamiliaShell } from "@/components/familia/Shell";

export default function FamiliaLayout({ children }: { children: ReactNode }) {
  return <FamiliaShell>{children}</FamiliaShell>;
}
