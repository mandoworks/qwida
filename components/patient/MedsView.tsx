"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MedSchedule } from "@/components/photo/MedSchedule";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { Loading } from "./Loading";
import { useFirstLoad } from "./useFirstLoad";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { scheduleItems } from "@/lib/photo/schedule";

/** Confirmed medicines in four daily slots, using W2's schedule at patient size. */
export function MedsView() {
  const { events, error } = useEvents();
  const loaded = useFirstLoad(events.length > 0, error);
  // The date only matters on the phone; the server render has no events anyway.
  const today = useSyncExternalStore(() => () => {}, () => todayPR(), () => "1970-01-01");
  const items = useMemo(() => scheduleItems(events, today), [events, today]);

  return (
    <div className="flex flex-col gap-5">
      {!loaded && <Loading />}
      {loaded && items.length === 0 && (
        <p role="status" className="rounded-2xl border-2 border-line-strong bg-sand px-5 py-6 text-p-body">
          Todavía no hay medicinas confirmadas.
        </p>
      )}
      {loaded && <MedSchedule items={items} size="patient" />}
      <FenceNotice className="text-p-body" art />
    </div>
  );
}
