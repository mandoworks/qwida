import { ResetDemoButton } from "@/components/ResetDemoButton";
import { Art } from "@/components/ui/Art";
import { BigButton } from "@/components/ui/BigButton";
import { FenceNotice } from "@/components/ui/FenceNotice";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";

export default function RoleChooser() {
  return (
    <>
      <SyntheticBanner />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10">
        <header className="text-center">
          <Art slot="hero-abuela" alt="Yari abraza a su abuela, pintado a mano" width={600} height={333} className="mb-6 block h-auto w-full" />
          <h1 className="flex justify-center">
            <Art slot="logo-quida" alt="Qwida" width={160} className="h-auto" />
          </h1>
          <p className="mt-3 text-patient">¿Quién usa el teléfono?</p>
        </header>

        <nav aria-label="Elegir rol" className="flex flex-col gap-5">
          <BigButton href="/paciente">Paciente</BigButton>
          <BigButton href="/familia" variant="secondary">
            Familia
          </BigButton>
        </nav>

        <FenceNotice className="text-p-meta" art />

        <div className="mt-auto flex flex-wrap justify-center gap-3">
          <ResetDemoButton />
          <ResetDemoButton mode="full" />
        </div>
      </main>
    </>
  );
}
