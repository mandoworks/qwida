"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
import type { StringKey } from "@/lib/weekcard/strings";
import { ChevronLeft } from "./icons";
import { LangProvider } from "./LangProvider";
import { useLang } from "./lang-context";

const SECTIONS: { href: string; key: StringKey; icon: "home" | "check" | "timeline" | "card" | "bell" | "settings" | "search" }[] = [
  { href: "/familia", key: "nav.inicio", icon: "home" },
  { href: "/familia/revisar", key: "nav.revisar", icon: "check" },
  { href: "/familia/linea-de-tiempo", key: "nav.tiempo", icon: "timeline" },
  { href: "/familia/tarjeta", key: "nav.tarjeta", icon: "card" },
  { href: "/familia/recordatorios", key: "nav.recordatorios", icon: "bell" },
  { href: "/proveedores", key: "nav.especialistas", icon: "search" },
  { href: "/familia/ajustes", key: "nav.ajustes", icon: "settings" },
];

const ICON = {
  home: "M3 11l9-7 9 7M5 10v9h5v-6h4v6h5v-9",
  check: "M4 5h11l4 4v10H4zM8 13l3 3 5-6",
  timeline: "M6 3v18M6 7h14M6 12h14M6 17h9",
  card: "M4 6h16v12H4zM4 10h16M8 15h5",
  bell: "M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9zM10 18.5a2 2 0 0 0 4 0",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M7.7 16.3l-1.4 1.4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4",
};

/** Header, ES/EN toggle, the sections and the way back to the role chooser. */
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
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:border-2 focus:border-line-strong focus:bg-surface focus:px-4 focus:py-2 focus:font-bold"
      >
        {t("shell.skip")}
      </a>

      <SyntheticBanner />

      <div className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-5 md:px-6">
        <header className="flex flex-wrap items-start gap-4 border-b-2 border-line pb-4">
          <div className="mr-auto min-w-0">
            {/* "Cuidando", not "Cuidado": in Spanish "cuidado" reads as "watch out" (Marley QA). */}
            <h1 className="scroll-mt-24 text-c-hero font-bold leading-tight">{t("shell.title")}</h1>
            <p className="text-c-meta text-ink-mute">Marisol Rivera · Orlando, FL</p>
          </div>

          <Link
            href="/"
            className="flex min-h-tap-c items-center gap-2 rounded-btn border-2 border-line-strong bg-surface px-3 text-c-body font-bold motion-quick hover:bg-sand"
          >
            <ChevronLeft size={20} />
            {t("shell.back")}
          </Link>

          <div className="flex items-center gap-2">
            <span className="sr-only">{t("lang.label")}</span>
            <div role="group" aria-label={t("lang.label")} className="flex overflow-hidden rounded-full border-2 border-line">
              {(["es", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`min-h-tap-c px-4 text-c-body font-bold motion-quick ${
                    lang === code ? "bg-accent text-white" : "bg-surface text-ink"
                  }`}
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
                const active =
                  section.href === "/familia"
                    ? pathname === section.href
                    : section.href === "/proveedores"
                      ? pathname.startsWith(section.href)
                      : pathname.startsWith(section.href);
                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-tap-c items-center gap-2 rounded-btn border-2 px-3 py-2 text-c-body font-bold motion-quick ${
                        active
                          ? "border-accent bg-accent text-white"
                          : "border-line bg-surface text-ink hover:border-line-strong hover:bg-sand"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="size-5 shrink-0"
                      >
                        <path d={ICON[section.icon]} />
                      </svg>
                      {t(section.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main id="contenido" className="min-w-0 pb-16 text-c-body lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
