import type { ReactNode } from "react";
import { BigButton } from "@/components/ui/BigButton";

/** Every patient sub screen: a big title, the content, and the way home. */
export function ScreenShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold leading-tight">{title}</h1>
      {children}
      <BigButton href="/paciente" variant="secondary" className="mt-2">
        Volver al inicio
      </BigButton>
    </div>
  );
}
