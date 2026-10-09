import { ResetDemoButton } from "@/components/ResetDemoButton";
import { BigButton } from "@/components/ui/BigButton";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";

export default function RoleChooser() {
  return (
    <>
      <SyntheticBanner />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10">
        <header className="text-center">
          <h1 className="text-5xl font-bold text-accent">Quida</h1>
          <p className="mt-3 text-patient">¿Quién usa el teléfono?</p>
        </header>

        <nav aria-label="Elegir rol" className="flex flex-col gap-5">
          <BigButton href="/paciente">Paciente</BigButton>
          <BigButton href="/cuidador" variant="secondary">
            Cuidador
          </BigButton>
        </nav>

        <FenceNotice className="text-lg" />

        <div className="mt-auto flex justify-center">
          <ResetDemoButton />
        </div>
      </main>
    </>
  );
}
