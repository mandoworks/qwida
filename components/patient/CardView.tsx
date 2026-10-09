"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Art } from "@/components/ui/Art";
import { BigButton } from "@/components/ui/BigButton";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { Loading } from "./Loading";
import { useFirstLoad } from "./useFirstLoad";
import { SpeakerIcon } from "./Icons";
import { cardKey, inkOn, latestWeekcard, speechText } from "./logic";
import { useLocalValue } from "./useLocalValue";
import { useEvents } from "@/lib/client/useEvents";

const PREFERRED_LANGS = ["es-pr", "es-us", "es-mx"];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  for (const lang of PREFERRED_LANGS) {
    const hit = es.find((v) => v.lang.toLowerCase().replace("_", "-") === lang);
    if (hit) return hit;
  }
  return es[0];
}

/** Reads the card aloud. Rate 0.9, Spanish voice if the phone has one. */
function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function toggle(text: string) {
    if (!("speechSynthesis" in window)) {
      setUnsupported(true);
      return;
    }
    const synth = window.speechSynthesis;
    if (synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    u.voice = voice ?? null;
    u.lang = voice?.lang ?? "es-US";
    u.rate = 0.9;
    u.onend = u.onerror = () => mounted.current && setSpeaking(false);
    synth.speak(u);
    setSpeaking(true);
  }

  return { speaking, unsupported, toggle };
}

export function CardView() {
  const { events, error } = useEvents();
  const loaded = useFirstLoad(events.length > 0, error);
  const [, setSeen] = useLocalValue("quida.seenCard");
  const { speaking, unsupported, toggle } = useReadAloud();
  const latest = latestWeekcard(events);
  const key = latest ? cardKey(latest.event) : null;

  useEffect(() => {
    if (key) setSeen(key);
  }, [key, setSeen]);

  if (!latest && !loaded) return <Loading />;

  if (!latest) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-line-strong bg-sand px-5 py-6">
        <Art slot="vacio-tarjeta" alt="Un sobre en camino con un corazón" width={240} height={160} />
        <p className="text-p-body">Marisol todavía no le ha enviado su tarjeta.</p>
        <p className="text-p-body text-ink-soft">Cuando Marisol apruebe su tarjeta, aparecerá aquí.</p>
      </div>
    );
  }

  const { card, removed } = latest;
  // A theme is used only when its colors keep AAA contrast; otherwise the default tokens stay.
  const headInk = card.theme ? inkOn(card.theme.primary) : null;
  const accentInk = card.theme ? inkOn(card.theme.accent) : null;
  const themed = card.theme && headInk && accentInk;
  const headStyle: CSSProperties | undefined = themed
    ? { backgroundColor: card.theme!.primary, color: headInk }
    : undefined;
  const dayStyle: CSSProperties | undefined = themed
    ? { backgroundColor: card.theme!.accent, color: accentInk }
    : undefined;

  return (
    <article aria-label={card.title} className="flex flex-col gap-5">
      <header
        className="rounded-2xl bg-accent px-5 py-4 text-accent-ink"
        style={headStyle}
      >
        <h2 className="text-p-title font-bold">{card.title}</h2>
      </header>

      <BigButton
        onClick={() => toggle(speechText(card))}
        icon={<SpeakerIcon />}
        aria-label={speaking ? "Detener la lectura" : "Escuchar la tarjeta"}
        aria-pressed={speaking}
      >
        {speaking ? "Detener" : "Escuchar"}
      </BigButton>
      {unsupported && (
        <p role="alert" className="text-p-body text-danger">
          Este teléfono no puede leer en voz alta.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {card.items.map((item, i) => (
          <li key={i} className="flex gap-4 rounded-2xl border-2 border-ink bg-surface p-4">
            {item.icon && item.icon.length <= 4 && (
              <span aria-hidden="true" className="text-4xl leading-none">
                {item.icon}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-2">
              <p
                className="w-fit rounded-lg bg-ink px-3 py-1 text-p-label font-bold text-bg"
                style={dayStyle}
              >
                {item.day}
                {item.time ? `, ${item.time}` : ""}
              </p>
              <p className="text-p-body">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {card.questionsForDoctor.length > 0 && (
        <section aria-label="Para preguntarle al doctor" className="flex flex-col gap-3">
          <h3 className="text-p-subtitle font-bold">Para preguntarle al doctor</h3>
          <ul className="flex flex-col gap-3">
            {card.questionsForDoctor.map((q, i) => (
              <li key={i} className="rounded-2xl border-2 border-line-strong bg-surface px-4 py-3 text-p-body">
                {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      {removed && <FenceNotice className="text-p-body" art />}

      <p className="text-p-body text-ink-soft">Esta tarjeta la aprobó Marisol.</p>
    </article>
  );
}
