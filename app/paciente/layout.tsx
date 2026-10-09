import type { ReactNode } from "react";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";

export default function PacienteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="yari-bg flex min-h-dvh flex-col">
      <SyntheticBanner />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8 text-p-body">{children}</main>
    </div>
  );
}
