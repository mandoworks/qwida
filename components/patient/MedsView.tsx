"use client";

import { useMemo } from "react";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import { PillIcon, SlotIcon } from "./Icons";
import { medSlots, SLOTS } from "./logic";

/** Four moments of the day with the confirmed medicines in each. Read only. */
export function MedsView() {
  const { events } = useEvents();
  const slots = useMemo(() => medSlots(events), [events]);
  const any = SLOTS.some((s) => slots[s].length > 0);

  return (
    <div className="flex flex-col gap-5">
      {!any && (
        <p role="status" className="rounded-2xl border-2 border-line bg-surface px-5 py-6 text-patient">
          Todavía no hay medicinas confirmadas.
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {SLOTS.map((slot) => (
          <li key={slot} className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-surface p-4">
            <div className="flex items-center gap-3">
              <SlotIcon slot={slot} />
              <h2 className="text-3xl font-bold capitalize">{slot}</h2>
            </div>
            {slots[slot].length === 0 ? (
              <p className="text-patient text-ink-soft">Nada en este momento</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {slots[slot].map((m, i) => (
                  <li key={`${m.id}-${i}`} className="flex items-center gap-3 text-patient">
                    <PillIcon />
                    <span className="font-bold capitalize">{m.drug}</span>
                    {m.dose && <span>{m.dose}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <FenceNotice className="text-patient" />
    </div>
  );
}
