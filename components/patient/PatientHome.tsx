"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
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
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 px-5 py-5 text-center transition-transform active:scale-[0.98] ${
        highlight ? "border-accent bg-accent text-accent-ink ring-4 ring-warn" : "border-ink bg-surface text-ink"
      }`}
    >
      {icon}
      <span className="text-3xl font-bold">{title}</span>
      {hint && <span className="text-patient leading-snug">{hint}</span>}
    </Link>
  );
}

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
      <header>
        <h1 className="text-4xl font-bold leading-tight">{greeting}, Doña Carmen</h1>
      </header>

      <Notices notices={notices} onDismiss={dismiss} />

      {isNew && (
        <p
          role="status"
          className="rounded-2xl border-2 border-warn bg-surface px-5 py-4 text-patient font-bold text-warn"
        >
          Nueva tarjeta de Marisol
        </p>
      )}

      <nav aria-label="Qué quiere hacer" className="flex flex-col gap-5">
        <Tile href="/paciente/grabar" icon={<MicIcon />} title="Grabar mi cita" />
        <Tile
          href="/paciente/foto"
          icon={<CameraIcon />}
          title="Foto"
          hint="Presione aquí para mandar una foto"
        />
        <Tile href="/paciente/tarjeta" icon={<CardIcon />} title="Mi tarjeta" highlight={isNew} />
        <Tile href="/paciente/hablar" icon={<VoiceIcon />} title="Hablar" hint="Un mensaje de voz para Marisol" />
      </nav>

      <InstallHint />
    </div>
  );
}
