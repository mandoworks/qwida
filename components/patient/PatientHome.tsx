"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Art } from "@/components/ui/Art";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useEvents } from "@/lib/client/useEvents";
import { InstallButton } from "./InstallButton";
import { CameraIcon, CardIcon, MicIcon, PhoneIcon, VoiceIcon } from "./Icons";
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

/** Color coding from the patient home mockup: one color per action, dark ink on a soft tile. */
const TILE_THEMES = {
  hablar: "bg-tile-hablar text-tile-hablar-ink border-tile-hablar-ink",
  foto: "bg-tile-foto text-tile-foto-ink border-tile-foto-ink",
  grabar: "bg-tile-grabar text-tile-grabar-ink border-tile-grabar-ink",
  tarjeta: "bg-tile-tarjeta text-tile-tarjeta-ink border-tile-tarjeta-ink",
} as const;

function Tile({
  href,
  icon,
  title,
  ariaLabel,
  theme,
  highlight = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  ariaLabel: string;
  theme: keyof typeof TILE_THEMES;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`yari-tile flex min-h-[11rem] w-full flex-col items-center justify-center gap-4 rounded-3xl border-4 p-5 shadow-tile transition-transform active:scale-[0.98] min-[420px]:flex-row min-[420px]:gap-6 min-[420px]:p-6 ${TILE_THEMES[theme]} ${
        highlight ? "ring-4 ring-warn ring-offset-2 ring-offset-bg" : ""
      }`}
    >
      <span className="w-24 shrink-0 min-[420px]:w-[7.5rem]" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-center text-p-title font-bold leading-tight min-[420px]:text-left">{title}</span>
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
        <h1 className="yari-headline text-p-hero font-bold">{greeting}, Doña Carmen.</h1>
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
        <Tile
          href="/paciente/hablar"
          theme="hablar"
          icon={<Art slot="icon-hablar" alt="" width={120} className="h-auto w-full" fallback={VoiceIcon} />}
          title="Hablar"
          ariaLabel="Hablar: mandar un mensaje de voz"
        />
        <Tile
          href="/paciente/foto"
          theme="foto"
          icon={<Art slot="icon-foto" alt="" width={120} className="h-auto w-full" fallback={CameraIcon} />}
          title="Foto"
          ariaLabel="Foto: mandar una foto"
        />
        <Tile
          href="/paciente/grabar"
          theme="grabar"
          icon={<Art slot="icon-grabar-cita" alt="" width={120} className="h-auto w-full" fallback={MicIcon} />}
          title="Grabar mi Cita"
          ariaLabel="Grabar mi cita: grabar la consulta"
        />
        <Tile
          href="/paciente/tarjeta"
          theme="tarjeta"
          icon={<Art slot="icon-mi-tarjeta" alt="" width={120} className="h-auto w-full" fallback={CardIcon} />}
          title="Mi Tarjeta"
          ariaLabel="Mi tarjeta: ver la tarjeta de la semana"
          highlight={isNew}
        />
      </nav>

      <div className="flex flex-col items-center gap-2 text-center">
        <a
          href="tel:911"
          className="inline-flex min-h-btn-patient w-full items-center justify-center rounded-2xl border-2 border-danger bg-danger-soft px-5 py-3 text-p-body font-bold text-danger transition-transform active:scale-[0.98]"
        >
          Emergencia: Llamar al 911
        </a>
        <a
          href={MARISOL_TEL}
          className="inline-flex min-h-btn-patient items-center justify-center gap-2 rounded-2xl border-2 border-line-strong bg-surface px-5 py-3 text-p-body font-bold text-ink transition-transform active:scale-[0.98]"
        >
          <PhoneIcon />
          Llamar a Marisol
        </a>
      </div>

      <FenceNotice className="text-p-meta" art />

      <InstallButton />
    </div>
  );
}
