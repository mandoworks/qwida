import type { ReactNode } from "react";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";

export default function PacienteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SyntheticBanner />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8 text-patient">{children}</main>
    </>
  );
}
