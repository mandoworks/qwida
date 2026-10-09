"use client";

import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { CameraIcon } from "./Icons";
import type { Notice } from "./logic";

/** Fixed copy only: the Fence strings and the label rescan line never come from a model. */
export const NUDGE_COPY = "Cuando recoja la receta, escanee la etiqueta de la farmacia.";

export function Notices({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: string) => void }) {
  if (!notices.length) return null;
  return (
    <section aria-label="Avisos" className="flex flex-col gap-4">
      {notices.map((n) =>
        n.type === "fence" ? (
          <div key={n.id} className="flex flex-col gap-3">
            {n.emergency && <EmergencyBanner className="rounded-2xl" />}
            <FenceNotice className="text-patient" />
            <BigButton variant="secondary" onClick={() => onDismiss(n.id)}>
              Entendido
            </BigButton>
          </div>
        ) : (
          <div key={n.id} role="note" className="flex flex-col gap-3 rounded-2xl border-2 border-warn bg-surface p-5">
            <p className="text-patient font-bold">{NUDGE_COPY}</p>
            <BigButton href="/paciente/foto" icon={<CameraIcon />}>
              Foto
            </BigButton>
            <BigButton variant="secondary" onClick={() => onDismiss(n.id)}>
              Más tarde
            </BigButton>
          </div>
        ),
      )}
    </section>
  );
}
