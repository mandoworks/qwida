import { Art } from "./Art";

export type BadgeKind = "BORRADOR" | "POR_CONFIRMAR" | "CONFIRMADO" | "SINTETICO" | "SIMULADO";

const STYLES: Record<BadgeKind, { label: string; className: string; title: string }> = {
  BORRADOR: {
    label: "BORRADOR",
    className: "border-ink-soft text-ink-soft bg-surface",
    title: "Borrador hecho por la IA",
  },
  POR_CONFIRMAR: {
    label: "POR CONFIRMAR",
    className: "border-warn text-warn bg-surface",
    title: "Necesita que una persona lo confirme",
  },
  CONFIRMADO: {
    label: "CONFIRMADO",
    className: "border-ok bg-ok text-white",
    title: "Confirmado por una persona",
  },
  SINTETICO: {
    label: "SINTÉTICO",
    className: "border-ink bg-ink text-bg",
    title: "Datos ficticios para la demostración",
  },
  SIMULADO: {
    label: "SIMULADO",
    className: "border-sim text-sim bg-surface",
    title: "Función simulada, no está corriendo de verdad",
  },
};

/**
 * Status vocabulary shared by both sides. Accepts store statuses directly.
 * `size="patient"` renders at the 20px elderly floor per the typography spec;
 * the default compact badge keeps the family member rendering unchanged.
 */
export function Badge({
  kind,
  className = "",
  size = "familia",
}: {
  kind: BadgeKind;
  className?: string;
  size?: "patient" | "familia";
}) {
  const s = STYLES[kind];
  const sizeCls =
    size === "patient"
      ? "px-3 py-1 text-p-meta font-bold"
      : "px-2 py-0.5 text-sm font-bold tracking-wide";
  const badge = (
    <span
      title={s.title}
      className={`inline-flex items-center rounded-md border-2 ${sizeCls} ${s.className} ${className}`}
    >
      {s.label}
    </span>
  );
  if (kind !== "CONFIRMADO") return badge;
  return (
    <span className="inline-flex items-center gap-2">
      <Art slot="sello-confirmado" alt="" width={40} />
      {badge}
    </span>
  );
}
