import { BigButton } from "@/components/ui/BigButton";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";

export default function NotFound() {
  return (
    <>
      <SyntheticBanner />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10 text-patient">
        <h1 className="text-4xl font-bold leading-tight">No encontramos esa página</h1>
        <p className="text-ink-soft">Puede que el enlace esté mal escrito.</p>
        <BigButton href="/">Ir al inicio</BigButton>
      </main>
    </>
  );
}
