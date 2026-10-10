"use client";

import Link from "next/link";
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
import { Alert, AvatarCarmen, Bell, Calendar, Pill, Search, Phone, Message, Eye, Seal } from "./icons";
import { useLang } from "./lang-context";
import { Pending } from "./Pending";

const SEEN_KEY = "quida.cuidador.seenAt";
// Each achievement wears one of Yari's hand drawn pieces already in the app.
const MEDALS: { slot: string; key: StringKey }[] = [
  { slot: "receta-letra", key: "logros.lista_doctor" },
  { slot: "etiqueta-farmacia", key: "logros.foto_dia" },
  { slot: "cerca", key: "logros.en_familia" },
  { slot: "slot-manana", key: "logros.recordatorio" },
  { slot: "avatar-marisol", key: "logros.acompanante" },
  { slot: "slot-noche", key: "logros.primera_llamada" },
];


const CHANGE_KEY: Record<string, StringKey> = {
  visit: "digest.change.visit",
  photo: "digest.change.photo",
  fence: "digest.change.fence",
  weekcard: "digest.change.weekcard",
  referido: "digest.change.referido",
  appointment: "digest.change.appointment",
  lab: "digest.change.lab",
  doctor_note: "digest.change.doctor_note",
};

const ACTION_KEY: Record<DigestAction["key"], StringKey> = {
  fence: "digest.action.fence",
  review: "digest.action.review",
  weekcard: "digest.action.weekcard",
  reminders: "digest.action.reminders",
  timeline: "digest.action.timeline",
};

/**
 * Family dashboard with the warm handmade design from the prototype.
 * Uses real data from the event store only. No sample data, no demo
 * toggle. Empty states are honest when there is nothing to show.
 *
 * NOTE (Armando 2026-10-09): the DESIGN.md "synthetic data only" rule is
 * intentionally overridden here. The family side must work with real data
 * paths, not the Carmen/Ana sample datasets.
 */
export function FamilyDashboard() {
  const { events, error } = useEvents();
  const { t } = useLang();
  const [savedSeenAt, setSeenAt] = useLocalValue(SEEN_KEY);
  const seenAt = savedSeenAt ?? "";

  const clock = useClock();
  const now = clock === null ? null : new Date(clock);
  const today = clock === null ? null : now ? todayPR(now) : null;
  const digest = today === null ? null : buildDigest(events, { seenAt: seenAt || null, today });

  const newest = events.reduce<string | null>((max, e) => (!max || e.updatedAt > max ? e.updatedAt : max), null);

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
  const appointment = digest.next.find((n) => n.kind === "cita");
  const soonRefill = digest.refills[0];
  const hasContent = appointment || soonRefill || digest.referred.length > 0 || digest.changes.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {digest.fence?.emergency && <EmergencyBanner className="-mx-4 sm:-mx-6" />}

      {/* Status card */}
      <section aria-label={t("digest.title")} className="overflow-hidden rounded-card border-2 border-line-strong bg-surface shadow-card">
        <div className={`flex items-center gap-4 border-b border-line p-5 ${digest.hero === "ok" ? "bg-ok-soft" : "bg-warn-soft"}`}>
          <Art slot="avatar-carmen" alt={t("dashboard.patient.alt")} width={72} fallback={({ size }) => <AvatarCarmen size={size} className="shrink-0 text-ink" />} />
          <div className="min-w-0 flex-1">
            <h2 className="text-c-title font-bold leading-tight">
              {digest.hero === "ok"
                ? t("digest.hero.ok")
                : digest.hero === "fence"
                  ? t("digest.hero.fence")
                  : pendingCount === 1
                    ? t("digest.hero.warn1")
                    : t("digest.hero.warnN", { n: pendingCount })}
            </h2>
            {!hasContent && (
              <p className="mt-1 text-c-body text-ink-soft">{t("dashboard.empty.hint")}</p>
            )}
          </div>
          <span className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-c-body font-bold ${digest.hero === "ok" ? "bg-ok text-white" : "bg-warn text-white"}`}>
            <span aria-hidden="true" className="size-2 rounded-full bg-white" />
            {digest.hero === "ok" ? t("dashboard.status.ok") : t("dashboard.status.attention")}
          </span>
        </div>

        {digest.fence && (
          <div className="flex flex-col gap-3 border-b border-line p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Art slot="cerca" alt="" width={24} fallback={() => <Alert size={20} className="text-warn" />} />
              <span className="mr-auto text-c-title font-bold">{t("digest.change.fence")}</span>
              <Badge kind="POR_CONFIRMAR" />
            </div>
            <p className="text-c-body">{digest.fence.emergency ? t("digest.fence.emergency") : t("digest.fence.med")}</p>
            <FenceNotice />
          </div>
        )}

        {digest.changes.length > 0 && (
          <ul className="divide-y divide-line">
            {digest.changes.slice(0, 3).map((change) => (
              <li key={change.id} className="flex flex-wrap items-center gap-2 p-4">
                <span className="text-c-meta tabular-nums text-ink-mute">{ago(change.at)}</span>
                <span className="text-c-body font-bold">{t(CHANGE_KEY[change.kind] ?? "digest.change.visit")}</span>
              </li>
            ))}
          </ul>
        )}

        {digest.changes.length > 3 && (
          <p className="border-t border-line p-4">
            <Link href="/familia/linea-de-tiempo" className="text-c-body font-bold text-accent underline">
              {t("digest.changesMore", { n: digest.changes.length })}
            </Link>
          </p>
        )}
      </section>

      {/* Quick actions */}
      <section aria-label={t("dashboard.actions.title")}>
        <h3 className="mb-3 text-c-title font-bold">{t("dashboard.actions.title")}</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/familia/revisar" className="flex min-h-tap-c-lg flex-col gap-2 rounded-card border-2 border-line-strong bg-warn-soft p-4 text-ink shadow-card motion-quick hover:-translate-y-0.5">
            <Eye size={28} className="text-warn" />
            <span className="text-c-body font-bold leading-tight">{t("dashboard.actions.review")}</span>
            {pendingCount > 0 && <span className="text-c-meta text-ink-soft">{t("digest.pending", { n: pendingCount })}</span>}
          </Link>
          <Link href="/familia/tarjeta" className="flex min-h-tap-c-lg flex-col gap-2 rounded-card border-2 border-line-strong bg-accent-soft p-4 text-ink shadow-card motion-quick hover:-translate-y-0.5">
            <Seal size={28} className="text-accent" />
            <span className="text-c-body font-bold leading-tight">{t("dashboard.actions.card")}</span>
            <span className="text-c-meta text-ink-soft">{t("dashboard.actions.cardSub")}</span>
          </Link>
          <Link href="/familia/recordatorios" className="flex min-h-tap-c-lg flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 text-ink shadow-card motion-quick hover:-translate-y-0.5">
            <Bell size={28} className="text-accent" />
            <span className="text-c-body font-bold leading-tight">{t("nav.recordatorios")}</span>
            <span className="text-c-meta text-ink-soft">{t("nudges.lead")}</span>
          </Link>
          <Link href="/familia/proveedores" className="flex min-h-tap-c-lg flex-col gap-2 rounded-card border-2 border-line-strong bg-surface p-4 text-ink shadow-card motion-quick hover:-translate-y-0.5">
            <Search size={28} className="text-accent" />
            <span className="text-c-body font-bold leading-tight">{t("nav.especialistas")}</span>
            <span className="text-c-meta text-ink-soft">{t("dashboard.actions.searchSub")}</span>
          </Link>
        </div>
      </section>

      {/* Logros */}
      <section aria-label={t("dashboard.logros.title")} className="rounded-card border-2 border-line-strong bg-surface p-5 shadow-card">
        <h3 className="mb-1 text-c-title font-bold">{t("dashboard.logros.title")}</h3>
        <p className="mb-4 text-c-body text-ink-soft">{t("dashboard.logros.hint")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MEDALS.map((medal) => (
            <div key={medal.slot} className="flex flex-col items-center gap-2 rounded-well bg-sand p-4 opacity-70">
              <Art slot={medal.slot} alt="" width={80} className="h-auto" />
              <span className="text-center text-c-body font-bold leading-tight">{t(medal.key)}</span>
              <span className="rounded-full bg-line px-3 py-1 text-c-meta font-bold text-ink-mute">{t("dashboard.logros.locked")}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly plan and contact */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t("digest.next.title")} className="flex flex-col gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
          <h3 className="text-c-title font-bold">{t("dashboard.plan.title")}</h3>

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
                size="caregiver"
              />
              <Link href="/familia/recordatorios" className="text-c-body font-bold text-accent underline">
                {t("digest.refill.renew")}
              </Link>
            </div>
          ))}

          {!hasContent && (
            <p className="text-c-body text-ink-soft">{t("dashboard.empty.plan")}</p>
          )}

          <Link href="/familia/tarjeta" className="mt-auto text-c-body font-bold text-accent underline">
            {t("dashboard.plan.card")}
          </Link>
        </section>

        <section aria-label={t("dashboard.contact.title")} className="flex flex-col gap-3 rounded-card border-2 border-line-strong bg-surface p-4 shadow-card">
          <h3 className="text-c-title font-bold">{t("dashboard.contact.title")}</h3>
          <div className="flex flex-col gap-2">
            <Link href="/familia/revisar" className="flex min-h-tap-c items-center gap-3 rounded-well bg-sand px-4 text-c-body font-bold">
              <Message size={20} className="text-accent" />
              {t("dashboard.contact.message")}
            </Link>
            <a href="tel:+17870000000" className="flex min-h-tap-c items-center gap-3 rounded-well bg-sand px-4 text-c-body font-bold">
              <Phone size={20} className="text-accent" />
              {t("dashboard.contact.call")}
            </a>
          </div>
          {error && (
            <p className="text-c-body text-warn">{t("digest.offline")}</p>
          )}
        </section>
      </div>

      {/* Primary action */}
      {digest.action && (
        <section aria-label={t("digest.action")} className="rounded-card border-2 border-line-strong bg-surface p-5 shadow-card">
          <p className="text-c-meta uppercase tracking-wide text-ink-mute">{t("digest.actionLabel")}</p>
          <p className="mb-3 text-c-title font-bold">{actionTitle(t, digest.action, pendingCount)}</p>
          <BigButton href={digest.action.href} className="min-h-tap-c-lg text-c-body">
            {t(ACTION_KEY[digest.action.key], { n: pendingCount })}
          </BigButton>
        </section>
      )}
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
