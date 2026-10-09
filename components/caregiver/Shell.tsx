"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
import type { StringKey } from "@/lib/weekcard/strings";
import { LangProvider } from "./LangProvider";
import { useLang } from "./lang-context";
import { NavIcon } from "./NavIcon";

const SECTIONS: { href: string; key: StringKey }[] = [
  { href: "/cuidador", key: "nav.inicio" },
  { href: "/cuidador/revisar", key: "nav.revisar" },
  { href: "/cuidador/tiempo", key: "nav.tiempo" },
  { href: "/cuidador/tarjeta", key: "nav.tarjeta" },
  { href: "/cuidador/recordatorios", key: "nav.recordatorios" },
  { href: "/cuidador/ajustes", key: "nav.ajustes" },
];

/** Header, ES/EN toggle and the six sections. Two columns from 1024 px up. */
export function CaregiverShell({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <ShellBody>{children}</ShellBody>
    </LangProvider>
  );
}

function ShellBody({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useLang();
  const pathname = usePathname();

  return (
    <>
      <SyntheticBanner />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center gap-4 border-b-2 border-line pb-4">
          <div className="mr-auto">
            <h1 className="text-3xl font-bold leading-tight">Quida · Cuidador</h1>
            <p className="text-ink-soft">Marisol Rivera, Orlando</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-soft">{t("lang.label")}</span>
            <div role="group" aria-label={t("lang.label")} className="flex overflow-hidden rounded-xl border-2 border-ink">
              {(["es", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`min-h-11 px-4 font-bold ${lang === code ? "bg-accent text-accent-ink" : "bg-surface text-ink"}`}
                >
                  {t(code === "es" ? "lang.es" : "lang.en")}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
          <nav aria-label={t("nav.menu")} className="py-4 lg:py-6">
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {SECTIONS.map((section) => {
                const active = section.href === "/cuidador" ? pathname === section.href : pathname.startsWith(section.href);
                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 py-2 font-bold ${
                        active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink"
                      }`}
                    >
                      <NavIcon href={section.href} />
                      {t(section.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="min-w-0 pb-16 text-caregiver lg:py-6">{children}</main>
        </div>
      </div>
    </>
  );
}
