import { Badge } from "@/components/ui/Badge";

/**
 * Stand in for W2's `components/photo/PhotoCapture` until it lands. To switch:
 * render `<PhotoCapture />` in app/paciente/foto/page.tsx and delete this file.
 */
export function PhotoPlaceholder() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-sim bg-surface p-5">
      <Badge kind="SIMULADO" className="w-fit" />
      <p className="text-patient">
        Aquí podrá tomar una foto de su receta o de la etiqueta de la farmacia.
      </p>
      <p className="text-patient text-ink-soft">Esta función todavía no está conectada.</p>
    </div>
  );
}
