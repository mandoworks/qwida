import { Badge } from "./Badge";

/** Top strip on every surface: everything shown is fictional demo data. */
export function SyntheticBanner() {
  return (
    <div className="flex items-center justify-center gap-3 border-b-2 border-line bg-surface px-4 py-2 text-base">
      <Badge kind="SINTETICO" />
      <span className="text-ink-soft">Datos ficticios para la demostración</span>
    </div>
  );
}
