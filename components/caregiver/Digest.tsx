"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { buildDigest, type ChangeKind, type DigestAction, type NextKind } from "@/lib/weekcard/digest";
import { dayLabel } from "@/lib/weekcard/dates";
import { longDate, relativeTime, todayLong } from "@/lib/weekcard/format";
import type { StringKey } from "@/lib/weekcard/strings";
import { useClock } from "./clock";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

const SEEN_KEY = "quida.cuidador.seenAt";
const CHANGE_KEY: Record<ChangeKind, StringKey> = {
  visit: "digest.change.visit",
  photo: "digest.change.photo",
  fence: "digest.change.fence",
  weekcard: "digest.change.weekcard",
  referido: "digest.change.referido",
  appointment: "digest.change.appointment",
};

const ACTION_KEY: Record<DigestAction["key"], StringKey> = {
  fence: "digest.action.fence",
  review: "digest.action.review",
  weekcard: "digest.action.weekcard",
  reminders: "digest.action.reminders",
  timeline: "digest.action.timeline",
};

const MARK: Record<ChangeKind, string> = {
  visit: "●",
  photo: "▣",
  fence: "!",
  weekcard: "▤",
  referido: "➤",
  appointment: "+",
};

/** One glance for Marisol: what changed, what is next, and one thing to do. */
export function Digest() {
  const { events, error } = useEvents();
  const { t, lang } = useLang();
  const [savedSeenAt, setSeenAt] = useLocalValue(SEEN_KEY);
  const seenAt = savedSeenAt ?? "";

  // The clock is null until mounted, so nothing date bound renders in the prerender.
  const clock = useClock();
  const now = clock === null ? null : new Date(clock);
  const today = clock === null ? null : now ? todayPR(now) : null;
  // buildDigest is cheap enough to run on every poll: no memo, no stale cache.
  const digest = today === null ? null : buildDigest(events, { seenAt: seenAt || null, today });

  // Everything polled while this screen is open has now been seen.
  const newest = events.reduce<string | null>((max, e) => (!max || e.updatedAt > max ? e.updatedAt : max), null);
  useEffect(() => {
    if (newest && newest !== seenAt) setSeenAt(newest);
  }, [newest, seenAt, setSeenAt]);

  if (!digest || !now || !today) {
    return (
      <Pending label={t("digest.loading")}>
        <div className="h-40 rounded-card border-2 border-line bg-surface" />
      </Pending>
    );
  }

  const pendingCount = digest.pending.length;

  return (
    <div className="flex flex-col gap-5">
      {digest.fence?.emergency && <EmergencyBanner className="-mx-4 sm:-mx-6" />}

      <header>
        <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{t("digest.title")}</h2>
        <p className="text-ink-soft">
          Doña Carmen Rivera, 78, Adjuntas · {todayLong(lang, now)}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-danger bg-surface px-4 py-3 text-danger">
          {error}
        </p>
      )}

      {digest.fence && (
        <section aria-label={t("digest.change.fence")} className="rounded-2xl border-2 border-danger bg-surface p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-2xl font-bold text-danger">{t("digest.change.fence")}</h3>
            <Badge kind="POR_CONFIRMAR" />
          </div>
          <p className="mb-3">{digest.fence.emergency ? t("digest.fence.emergency") : t("digest.fence.med")}</p>
          <FenceNotice />
          <Link href="/cuidador/revisar" className="mt-3 inline-block font-bold text-accent underline">
            {t("digest.action.fence")}
          </Link>
        </section>
      )}

      <section aria-label={t("digest.changes")} className="rounded-2xl border-2 border-line bg-surface p-5">
        <h3 className="mb-3 text-2xl font-bold">{t("digest.changes")}</h3>
        {digest.changes.length === 0 ? (
          <p className="text-ink-soft">{seenAt ? t("digest.noChanges") : t("digest.quiet")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {digest.changes.slice(0, 6).map((change) => (
              <li key={change.id} className="flex items-baseline gap-3">
                <span aria-hidden="true" className="w-5 shrink-0 text-center font-bold text-accent">
                  {MARK[change.kind]}
                </span>
                <span className="font-bold">{t(CHANGE_KEY[change.kind])}</span>
                <span className="ml-auto shrink-0 text-ink-soft">{ago(change.at, now, t)}</span>
              </li>
            ))}
          </ul>
        )}
        {pendingCount > 0 && <p className="mt-3 font-bold text-warn">{t("digest.pending", { n: pendingCount })}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label={t("digest.next")} className="rounded-2xl border-2 border-line bg-surface p-5">
          <h3 className="mb-3 text-2xl font-bold">{t("digest.next")}</h3>
          {digest.next.length === 0 ? (
            <p className="text-ink-soft">{t("digest.next.none")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {digest.next.map((thing) => (
                <li key={`${thing.kind}:${thing.id}`} className="flex flex-col">
                  <span className="font-bold">{nextLabel(t, thing.kind, thing.name, thing.days, dayLabel(thing.when))}</span>
                  <span className="text-ink-soft">{longDate(`${thing.when}T12:00:00`, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label={t("digest.action")} className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-surface p-5">
          <h3 className="text-2xl font-bold">{t("digest.action")}</h3>
          {digest.action && (
            <BigButton href={digest.action.href} className="min-h-14 py-3 text-xl">
              {t(ACTION_KEY[digest.action.key], { n: pendingCount })}
            </BigButton>
          )}
          {digest.next.some((n) => n.kind === "recarga" || n.kind === "referido") && (
            <Link href="/cuidador/recordatorios" className="font-bold text-accent underline">
              {t("nav.recordatorios")}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

function ago(iso: string, now: Date, t: (key: StringKey, values?: Record<string, string | number>) => string): string {
  const { key, n } = relativeTime(iso, now);
  return t(key, { n });
}

function nextLabel(
  t: (key: StringKey, values?: Record<string, string | number>) => string,
  kind: NextKind,
  name: string | null,
  days: number,
  when: string,
): string {
  if (kind === "cita") return t(name ? "digest.next.cita" : "digest.next.citaUnnamed", { name: name ?? "", when });
  if (kind === "recarga") return t(name ? "digest.next.recarga" : "digest.next.recargaUnnamed", { name: name ?? "", days });
  return t(name ? "digest.next.referido" : "digest.next.referidoUnnamed", { name: name ?? "", when });
}
