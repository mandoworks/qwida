"use client";

import { useState } from "react";
import Link from "next/link";
import { BigButton } from "@/components/ui/BigButton";
import { useLang } from "@/components/caregiver/lang-context";
import type { StringKey } from "@/lib/weekcard/strings";

type Step = "welcome" | "patient" | "contact" | "sent";

/**
 * Family onboarding flow. Walks a new caregiver through setup and ends
 * with a magic link that creates their account.
 *
 * TODO (roadmap): The magic link step is UI only. To finish it the team
 * needs:
 *   1. A POST /api/auth/magic-link endpoint that takes an email, creates a
 *      one-time token (e.g. 15 min expiry), and sends the link by email.
 *   2. A GET /api/auth/callback route that validates the token and creates
 *      the Supabase auth user plus the household row.
 *   3. Wire the "Enviar enlace" button below to call (1) instead of the
 *      current local-only behavior.
 * Until then the flow stores the onboarding answers locally and shows the
 * "link sent" screen without sending anything.
 */
export function FamilyOnboarding() {
  const { t } = useLang();
  const [step, setStep] = useState<Step>("welcome");
  const [patientName, setPatientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const next = () => {
    setError("");
    if (step === "welcome") setStep("patient");
    else if (step === "patient") {
      if (!patientName.trim()) {
        setError(t("onboard.patient.error"));
        return;
      }
      setStep("contact");
    } else if (step === "contact") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError(t("onboard.contact.error"));
        return;
      }
      // TODO (roadmap): POST /api/auth/magic-link with { email } here.
      // On success, advance. On failure, show the error.
      try {
        localStorage.setItem("quida.onboard.patient", patientName.trim());
        localStorage.setItem("quida.onboard.relationship", relationship.trim());
        localStorage.setItem("quida.onboard.email", email.trim());
      } catch {
        // Local storage is best effort; the flow still works.
      }
      setStep("sent");
    }
  };

  const back = () => {
    setError("");
    if (step === "patient") setStep("welcome");
    else if (step === "contact") setStep("patient");
    else if (step === "sent") setStep("contact");
  };

  return (
    <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-6">
      {/* Progress */}
      <ol aria-label={t("onboard.progress")} className="flex items-center gap-2">
        {(["welcome", "patient", "contact", "sent"] as Step[]).map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2 flex-1 rounded-full ${
                ["welcome", "patient", "contact", "sent"].indexOf(step) >= i
                  ? "bg-accent"
                  : "bg-line"
              }`}
            />
          </li>
        ))}
      </ol>

      {step === "welcome" && (
        <section aria-label={t("onboard.welcome.title")} className="flex flex-col gap-4 rounded-card border-2 border-line-strong bg-surface p-6 shadow-card">
          <h2 className="text-c-hero font-bold leading-tight">{t("onboard.welcome.title")}</h2>
          <p className="text-c-body">{t("onboard.welcome.body")}</p>
          <ul className="flex flex-col gap-2 text-c-body">
            <li className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-accent">1.</span>
              {t("onboard.welcome.s1")}
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-accent">2.</span>
              {t("onboard.welcome.s2")}
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-accent">3.</span>
              {t("onboard.welcome.s3")}
            </li>
          </ul>
        </section>
      )}

      {step === "patient" && (
        <section aria-label={t("onboard.patient.title")} className="flex flex-col gap-4 rounded-card border-2 border-line-strong bg-surface p-6 shadow-card">
          <h2 className="text-c-hero font-bold leading-tight">{t("onboard.patient.title")}</h2>
          <p className="text-c-body text-ink-soft">{t("onboard.patient.body")}</p>
          <div className="flex flex-col gap-2">
            <label htmlFor="onboard-patient-name" className="text-c-body font-bold">
              {t("onboard.patient.name")}
            </label>
            <input
              id="onboard-patient-name"
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder={t("onboard.patient.namePh")}
              className="min-h-tap-c rounded-well border-2 border-line-strong bg-surface px-4 text-c-body"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="onboard-relationship" className="text-c-body font-bold">
              {t("onboard.patient.rel")}
            </label>
            <input
              id="onboard-relationship"
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder={t("onboard.patient.relPh")}
              className="min-h-tap-c rounded-well border-2 border-line-strong bg-surface px-4 text-c-body"
              autoComplete="off"
            />
          </div>
          {error && <p role="alert" className="text-c-body font-bold text-danger">{error}</p>}
        </section>
      )}

      {step === "contact" && (
        <section aria-label={t("onboard.contact.title")} className="flex flex-col gap-4 rounded-card border-2 border-line-strong bg-surface p-6 shadow-card">
          <h2 className="text-c-hero font-bold leading-tight">{t("onboard.contact.title")}</h2>
          <p className="text-c-body text-ink-soft">{t("onboard.contact.body")}</p>
          <div className="flex flex-col gap-2">
            <label htmlFor="onboard-email" className="text-c-body font-bold">
              {t("onboard.contact.email")}
            </label>
            <input
              id="onboard-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("onboard.contact.emailPh")}
              className="min-h-tap-c rounded-well border-2 border-line-strong bg-surface px-4 text-c-body"
              autoComplete="email"
              inputMode="email"
            />
          </div>
          {error && <p role="alert" className="text-c-body font-bold text-danger">{error}</p>}
        </section>
      )}

      {step === "sent" && (
        <section aria-label={t("onboard.sent.title")} className="flex flex-col gap-4 rounded-card border-2 border-line-strong bg-ok-soft p-6 shadow-card">
          <h2 className="text-c-hero font-bold leading-tight">{t("onboard.sent.title")}</h2>
          <p className="text-c-body">{t("onboard.sent.body", { email: email.trim() })}</p>
          <p className="text-c-body text-ink-soft">{t("onboard.sent.hint")}</p>
          <Link href="/familia" className="text-c-body font-bold text-accent underline">
            {t("onboard.sent.dashboard")}
          </Link>
        </section>
      )}

      {/* Nav buttons */}
      <div className="flex gap-3">
        {step !== "welcome" && (
          <button
            type="button"
            onClick={back}
            className="min-h-tap-c-lg flex-1 rounded-btn border-2 border-line-strong bg-surface px-4 text-c-body font-bold motion-quick hover:bg-sand"
          >
            {t("onboard.back")}
          </button>
        )}
        {step !== "sent" && (
          <BigButton onClick={next} className="min-h-tap-c-lg flex-1 text-c-body">
            {step === "contact" ? t("onboard.contact.send") : t("onboard.next")}
          </BigButton>
        )}
      </div>
    </div>
  );
}
