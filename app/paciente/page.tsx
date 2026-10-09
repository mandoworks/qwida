import { SyntheticBanner } from "@/components/ui/SyntheticBanner";

// Placeholder. W4 owns this route.
export default function PacientePage() {
  return (
    <>
      <SyntheticBanner />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8 text-patient">
        <h1 className="text-4xl font-bold">Hola, Doña Carmen</h1>
      </main>
    </>
  );
}
