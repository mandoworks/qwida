import type { ScheduleItem } from "@/lib/photo/schedule";
import { SLOTS } from "@/lib/photo/trust";
import { PillIcon, SlotIcon } from "./icons";

const SLOT_LABEL: Record<string, string> = {
  mañana: "Mañana",
  mediodía: "Mediodía",
  tarde: "Tarde",
  noche: "Noche",
};

export type PhotoSize = "patient" | "caregiver";

/**
 * Daily schedule in four slots with a pill per medicine. Shows only what it is
 * given: pass confirmed rows from `scheduleItems(events, today)`.
 */
export function MedSchedule({ items, size = "patient" }: { items: ScheduleItem[]; size?: PhotoSize }) {
  const patient = size === "patient";
  return (
    <section aria-label="Horario de medicinas" className={patient ? "text-patient" : "text-caregiver"}>
      <ol className={patient ? "flex flex-col gap-4" : "grid gap-3 sm:grid-cols-2"}>
        {SLOTS.map((slot) => {
          const here = items.filter((i) => i.slots.includes(slot));
          return (
            <li key={slot} className="flex gap-4 rounded-2xl border-2 border-line bg-surface p-4">
              <SlotIcon slot={slot} className={patient ? "size-14 shrink-0 text-accent" : "size-9 shrink-0 text-accent"} />
              <div className="flex flex-col gap-2">
                <h3 className={patient ? "text-3xl font-bold" : "text-xl font-bold"}>{SLOT_LABEL[slot]}</h3>
                {here.length ? (
                  <ul className="flex flex-col gap-2">
                    {here.map((i) => (
                      <li key={i.id} className="flex items-center gap-3">
                        <PillIcon className={patient ? "size-9 shrink-0" : "size-6 shrink-0"} />
                        <span className="font-bold">
                          {i.drug}
                          {i.dose && <span className="font-normal"> {i.dose}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-soft">Nada</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!patient && items.some((i) => i.daysLeft !== null) && (
        <ul className="mt-4 flex flex-col gap-1">
          {items
            .filter((i) => i.daysLeft !== null)
            .map((i) => (
              <li key={i.id} className={i.daysLeft! <= 7 ? "font-bold text-warn" : ""}>
                {i.drug}: {i.daysLeft === 1 ? "le queda 1 día" : `le quedan unos ${i.daysLeft} días`}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
