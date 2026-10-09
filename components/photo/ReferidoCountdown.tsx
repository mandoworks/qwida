import { Art } from "@/components/ui/Art";
import { daysBetween, formatDia, todayPR } from "@/lib/photo/dates";
import type { PhotoSize } from "./MedSchedule";

/** Red within two weeks, amber within a month, green otherwise. */
function tone(days: number): string {
  if (days <= 14) return "border-danger text-danger";
  if (days <= 30) return "border-warn text-warn";
  return "border-ok text-ok";
}

/** "Vence el 7 de enero" with the days left. `expiresOn` comes from code (issue date plus 90), never the model. */
export function ReferidoCountdown({
  specialty,
  expiresOn,
  today = todayPR(),
  size = "patient",
}: {
  specialty?: string | null;
  expiresOn: string;
  today?: string;
  size?: PhotoSize;
}) {
  const days = daysBetween(today, expiresOn);
  const patient = size === "patient";
  const left = days < 0 ? "Ya venció" : days === 0 ? "Vence hoy" : days === 1 ? "Queda 1 día" : `Quedan ${days} días`;
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border-2 bg-surface p-4 ${tone(days)} ${patient ? "text-patient" : "text-caregiver"}`}>
      <Art slot="referido" alt="Un referido con un calendario" width={patient ? 160 : 120} height={patient ? 120 : 90} />
      {specialty && <p className="text-ink">Referido a {specialty}</p>}
      <p className={patient ? "text-3xl font-bold" : "text-xl font-bold"}>
        {days < 0 ? "Venció" : "Vence"} el {formatDia(expiresOn)}
      </p>
      <p className="font-bold">{left}</p>
    </div>
  );
}
