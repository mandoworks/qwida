"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom tab bar for the patient side. Two big tabs: Inicio and Doctores.
 * 72px touch targets, Yari styling, the active tab raised like a sticker.
 * Mi Tarjeta lives on the home tiles, not here.
 */
const TABS = [
  {
    href: "/paciente",
    label: "Inicio",
    icon: "M4 11l8-6 8 6M6 10v9h4v-5h4v5h4v-9",
  },
  {
    href: "/paciente/proveedores",
    label: "Doctores",
    icon: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12M18 18l-4-4",
  },
] as const;

export function PatientTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="sticky bottom-0 z-40 border-t-4 border-ink bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 px-6 py-3">
        {TABS.map((tab) => {
          const active =
            tab.href === "/paciente" ? pathname === "/paciente" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-[3px] px-2 py-2 text-center text-p-label font-bold transition-transform active:scale-95 ${
                active
                  ? "border-ink bg-accent text-accent-ink shadow-tab-active -translate-y-1"
                  : "border-ink-soft bg-surface text-ink"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
                aria-hidden="true"
              >
                <path d={tab.icon} />
              </svg>
              <span className="leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
