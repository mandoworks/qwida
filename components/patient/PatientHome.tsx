"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Art } from "@/components/ui/Art";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import { InstallHint } from "./InstallHint";
import { CameraIcon, CardIcon, MicIcon, VoiceIcon } from "./Icons";
import { activeNotices, cardKey, greetingFor, latestWeekcard } from "./logic";
import { Notices } from "./Notices";
import { useLocalValue } from "./useLocalValue";

/** "Hola" on the server, the real greeting on the phone, so the HTML never lies about the hour. */
function useGreeting() {
  return useSyncExternalStore(
    () => () => {},
    () => greetingFor(new Date().getHours()),
    () => "Hola",
  );
}

function Tile({
  href,
  icon,
  title,
  hint,
  highlight = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[168px] w-full flex-col items-start gap-3 rounded-3xl border-2 p-5 text-left shadow-tile transition-transform active:scale-[0.98] ${
        highlight ? "border-accent bg-accent text-accent-ink ring-4 ring-warn" : "border-ink bg-surface text-ink"
      }`}
    >
      {icon}
      <span className="text-p-tile font-bold">{title}</span>
      <span className={`text-p-label ${highlight ? "" : "text-ink-soft"}`}>{hint}</span>
      <span aria-hidden="true" className="ml-auto self-end text-3xl leading-none">
        ›
      </span>
    </Link>
  );
}

/** Fictional number from the 555-01XX range reserved for fiction. Synthetic data only. */
const MARISOL_TEL = "tel:+14075550142";

export function PatientHome() {
  const { events } = useEvents();
  const greeting = useGreeting();
  const [seenCard] = useLocalValue("quida.seenCard");
  const [dismissedRaw, setDismissedRaw] = useLocalValue("quida.dismissedNotices");

  const latest = useMemo(() => latestWeekcard(events), [events]);
  const isNew = !!latest && seenCard !== undefined && seenCard !== cardKey(latest.event);

  const dismissed = useMemo(() => new Set((dismissedRaw ?? "").split(",").filter(Boolean)), [dismissedRaw]);
  const notices = useMemo(() => activeNotices(events, dismissed), [events, dismissed]);
  const dismiss = (id: string) => setDismissedRaw([...dismissed, id].join(","));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="-mb-2 self-end py-2 text-p-meta text-ink-mute underline underline-offset-4">
          Cambiar de rol
        </Link>
        <h1 className="text-p-hero font-bold">{greeting}, Doña Carmen.</h1>
        <p className="text-p-body text-ink-soft">Toque un botón. Nada más.</p>
      </header>

      <Notices notices={notices} onDismiss={dismiss} />

      {isNew && (
        <p
          role="status"
          className="rounded-2xl border-2 border-warn bg-warn-soft px-5 py-4 text-p-body font-bold text-ink"
        >
          Nueva tarjeta de Marisol
        </p>
      )}

      <nav aria-label="Qué quiere hacer" className="flex flex-col gap-5">
        <Tile href="/paciente/hablar" icon={<Art slot="icon-hablar" alt="" width={88} fallback={VoiceIcon} />} title="Hablar" hint="Un mensaje de voz para Marisol" />
        <Tile href="/paciente/foto" icon={<Art slot="icon-foto" alt="" width={88} fallback={CameraIcon} />} title="Foto" hint="Toque aquí para mandar una foto" />
        <Tile href="/paciente/grabar" icon={<Art slot="icon-grabar-cita" alt="" width={88} fallback={MicIcon} />} title="Grabar mi cita" hint="Toque aquí para grabar la consulta" />
        <Tile
          href="/paciente/tarjeta"
          icon={<Art slot="icon-mi-tarjeta" alt="" width={88} fallback={CardIcon} />}
          title="Mi tarjeta"
          hint="Toque aquí para ver su semana"
          highlight={isNew}
        />
      </nav>

      <p className="text-center">
        <a href={MARISOL_TEL} className="inline-block py-3 text-p-meta text-ink-mute underline underline-offset-4">
          Llamar a Marisol
        </a>
      </p>

      <FenceNotice className="text-p-meta" art />

      <InstallHint />
    </div>
  );
}
