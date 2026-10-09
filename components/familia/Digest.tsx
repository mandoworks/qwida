"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Art } from "@/components/ui/Art";
import { Badge } from "@/components/ui/Badge";
import { BigButton } from "@/components/ui/BigButton";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { ReferidoCountdown } from "@/components/photo/ReferidoCountdown";
import { useLocalValue } from "@/components/patient/useLocalValue";
import { useEvents } from "@/lib/client/useEvents";
import { todayPR } from "@/lib/photo/dates";
import { buildDigest, type DigestAction } from "@/lib/weekcard/digest";
import { dayLabel } from "@/lib/weekcard/dates";
import { relativeTime } from "@/lib/weekcard/format";
import type { StringKey } from "@/lib/weekcard/strings";
import { useClock } from "./clock";
import { Alert, AvatarCarmen, Bell, Calendar, Pill, Search } from "./icons";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

const SEEN_KEY = "quida.familia.seenAt";
const MAX_CHANGES = 3;

const CHANGE_KEY: Record<string, StringKey> = {
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

const LINKS: { href: string; key: StringKey }[] = [
  { href: "/familia/linea-de-tiempo", key: "digest.link.timeline" },
  { href: "/familia/tarjeta", key: "digest.link.card" },
  { href: "/proveedores", key: "digest.link.specialists" },
  { href: "/familia/ajustes", key: "digest.link.settings" },
];

/** One glance for Marisol: DESIGN.md 4.14 and 5.5. Exactly one primary button. */
export function Digest() {
  const { events, error } = useEvents();
  const { t } = useLang();
  const [savedSeenAt, setSeenAt] = useLocalValue(SEEN_KEY);
  const seenAt = savedSeenAt ?? "";

  // The clock is null until mounted, so nothing date bound renders in the prerender.
  const clock = useClock();
  const now = clock === null ? null : new Date(clock);
  const today = clock === null ? null : now ? todayPR(now) : null;
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

  const ago = (iso: string) => {
    const { key, n } = relativeTime(iso, now);
    return t(key, { n });
  };
  const pendingCount = digest.pending.length;
  const changes = digest.changes.slice(0, MAX_CHANGES);
  const appointment = digest.next.find((n) => n.kind === "cita");
  const soonRefill = digest.refills[0];

  return (
    <div className="flex flex-col gap-5">
      {digest.fence?.emergency && <EmergencyBanner className="-mx-4 sm:-mx-6" />}

      <h2 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("digest.title")}</h2>

      {/* Live poll line: never a silent stale screen (5.5 item 3). */}
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" aria-live="polite" className="flex items-center gap-2 text-c-meta text-ink-mute">
          <span aria-hidden="true" className={`size-2 rounded-full ${error ? "bg-warn" : "bg-ok"}`} />
          {error ? t("digest.offline") : `${t("digest.updated")} ${ago(newest ?? now.toISOString())}`}
        </span>
        {error && (
          <button type="button" onClick={() => window.location.reload()} className="min-h-tap-c text-c-body font-bold text-accent underline">
            {t("digest.retry")}
          </button>
        )}
      </div>

      {/* Digest card (4.14) */}
      <section aria-label={t("digest.title")} className="overflow-hidden rounded-card border-2 border-line-strong bg-surface shadow-card">
        <div
          className={`flex items-center gap-3 border-b border-line p-5 ${
            digest.hero === "ok" ? "bg-ok-soft" : "bg-warn-soft"
          }`}
        >
          <Art slot="avatar-carmen" alt="Doña Carmen" width={72} fallback={({ size }) => <AvatarCarmen size={size} className="shrink-0 text-ink" />} />
          <div className="min-w-0">
            <p className="text-c-title font-bold">
              {digest.hero === "ok"
                ? t("digest.hero.ok")
                : digest.hero === "fence"
                  ? t("digest.hero.fence")
                  : pendingCount === 1
                    ? t("digest.hero.warn1")
                    : t("digest.hero.warnN", { n: pendingCount })}
            </p>
            {digest.lastSignal && (
              <p className="text-c-meta text-ink-mute">
                {t("digest.lastSignal", { ago: `${ago(digest.lastSignal.at)} (${t(`timeline.source.${digest.lastSignal.source}` as StringKey)})` })}
              </p>
            )}
          </div>
        </div>

        {digest.fence && (
          <div className="flex flex-col gap-3 border-b border-line p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Alert size={20} className="text-warn" />
              <span className="mr-auto text-c-title font-bold">{t("digest.change.fence")}</span>
              <Badge kind="POR_CONFIRMAR" />
            </div>
            <p className="text-c-body">{digest.fence.emergency ? t("digest.fence.emergency") : t("digest.fence.med")}</p>
            <FenceNotice />
          </div>
        )}

        <ul className="divide-y divide-line">
          {changes.length === 0 ? (
            <li className="p-5 text-c-body text-ink-soft">{seenAt ? t("digest.noChanges") : t("digest.quiet")}</li>
          ) : (
            changes.map((change) => (
              <li key={change.id} className="flex flex-wrap items-center gap-2 p-4">
                <Badge kind="SINTETICO" />
                <span className="text-c-meta tabular-nums text-ink-mute">{ago(change.at)}</span>
                <span className="text-c-body font-bold">{t(CHANGE_KEY[change.kind] ?? "digest.change.visit")}</span>
              </li>
            ))
          )}
        </ul>

        {digest.changes.length > MAX_CHANGES && (
          <p className="border-t border-line p-4">
            <Link href="/familia/linea-de-tiempo" className="text-c-body font-bold text-accent underline">
              {t("digest.changesMore", { n: digest.changes.length })}
            </Link>
          </p>
        )}

        {/* The only primary button on the screen. */}
        <div className="border-t border-line p-5">
          <p className="text-c-meta uppercase tracking-wide text-ink-mute">{t("digest.actionLabel")}</p>
          <p className="mb-3 text-c-title font-bold">{actionTitle(t, digest.action, pendingCount)}</p>
          {digest.action && (
            <BigButton href={digest.action.href} className="min-h-tap-c-lg text-c-body">
              {t(ACTION_KEY[digest.action.key], { n: pendingCount })}
            </BigButton>
          )}
        </div>
      </section>

      {/* Digest interval is SIMULADO (5.5 item 5). */}
      <p className="flex flex-wrap items-center gap-2 text-c-meta text-ink-mute">
        <Badge kind="SIMULADO" />
        <span className="font-bold">{t("digest.interval")}</span>
        <span className="rounded-well bg-sand px-3 py-1">{t("digest.intervalNote")}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* What is coming: refill, referral, next appointment. */}
        <section aria-label={t("digest.next.title")} className="flex flex-col gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
          <h3 className="text-c-title font-bold">{t("digest.next.title")}</h3>

          {appointment && (
            <p className="flex items-center gap-2 text-c-body">
              <Calendar size={20} className="shrink-0 text-ink-mute" />
              {appointment.name
                ? t("digest.next.cita", { name: appointment.name, when: dayLabel(appointment.when) })
                : t("digest.next.citaUnnamed", { when: dayLabel(appointment.when) })}
            </p>
          )}

          {soonRefill && (
            <div className="flex flex-col gap-1 rounded-well bg-sand p-3">
              <p className="flex items-center gap-2 text-c-body font-bold">
                <Pill size={20} />
                {t("digest.next.recarga", { name: soonRefill.drug, days: soonRefill.days })}
              </p>
              {soonRefill.days <= 7 && (
                <>
                  <p className="text-c-body">{t("digest.refill.soon")}</p>
                  <Link href="/familia/recordatorios" className="text-c-body font-bold text-accent underline">
                    {t("nav.recordatorios")}
                  </Link>
                </>
              )}
            </div>
          )}

          {digest.referred.map((referral) => (
            <div key={referral.id} className="flex flex-col gap-2">
              <ReferidoCountdown
                specialty={referral.specialty}
                expiresOn={referral.expires_on}
                today={today}
                size="familia"
              />
              <Link href="/familia/recordatorios" className="text-c-body font-bold text-accent underline">
                {t("digest.refill.renew")}
              </Link>
            </div>
          ))}

          {!appointment && !soonRefill && digest.referred.length === 0 && (
            <p className="text-c-body text-ink-soft">{t("digest.next.none")}</p>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section aria-label={t("nav.recordatorios")} className="flex items-start gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
            <Bell size={20} className="mt-1 shrink-0 text-accent" />
            <div>
              <p className="text-c-title font-bold">{t("nav.recordatorios")}</p>
              <p className="text-c-body text-ink-soft">{t("nudges.lead")}</p>
              <Link href="/familia/recordatorios" className="text-c-body font-bold text-accent underline">
                {t("nudges.title")}
              </Link>
            </div>
          </section>
          {digest.fence && <FenceNotice />}
        </div>
      </div>

      {/* Link row (5.5 item 7): a 4 card row on wide screens. */}
      <nav aria-label={t("digest.next.title")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-tap-c items-center gap-2 rounded-card border-2 border-line-strong bg-surface px-4 text-c-body font-bold shadow-card motion-quick hover:bg-sand"
          >
            {link.href === "/proveedores" && <Search size={20} />}
            {t(link.key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function actionTitle(
  t: (key: StringKey, values?: Record<string, string | number>) => string,
  action: DigestAction | null,
  pending: number,
): string {
  if (!action) return t("digest.quiet");
  if (action.key === "review") return t("digest.pending", { n: pending });
  return t(ACTION_KEY[action.key], { n: pending });
}
