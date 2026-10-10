import type { Metadata } from "next";
import Link from "next/link";
import { ProtocolSection } from "@/components/protocols/ProtocolSection";
import { ProviderSearch } from "@/components/providers/ProviderSearch";
import { VERIFY_URL, catalog } from "@/lib/providers/catalog";
import { formatConsulted } from "@/lib/providers/format";
import { ASES_RULE } from "@/lib/providers/referido";

export const metadata: Metadata = {
  title: "Profesionales de la salud en Puerto Rico | Qwida",
  description:
    "Busque profesionales de la salud de Puerto Rico en el directorio público de MedSeek PR.",
};

export default function ProveedoresPage() {
  const consulted = formatConsulted(catalog.fetched_at);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6">
      <Link href="/familia" className="text-lg underline">
        Volver al inicio
      </Link>

      <h1 className="mt-3 text-3xl font-bold md:text-4xl">Profesionales de la salud en Puerto Rico</h1>

      <p role="note" className="mt-4 rounded-2xl border-2 border-ink-soft bg-surface p-4 text-lg">
        Datos públicos reales, consultados el {consulted}. Qwida no recomienda médicos.
      </p>

      <div className="mt-6 text-caregiver">
        <ProviderSearch />
      </div>

      <p className="mt-6 text-base text-ink-soft">{ASES_RULE}</p>

      <section aria-labelledby="antes-de-su-cita" className="mt-8 flex flex-col gap-4 border-t-2 border-line pt-6">
        <h2 id="antes-de-su-cita" className="text-2xl font-bold md:text-3xl">
          Antes de su cita: no pierda el viaje
        </h2>
        <ProtocolSection />
      </section>

      <section aria-labelledby="de-donde-vienen" className="mt-8 flex flex-col gap-2 border-t-2 border-line pt-4">
        <h2 id="de-donde-vienen" className="text-lg font-bold">
          De dónde vienen estos datos
        </h2>
        <ul className="list-disc pl-6 text-base text-ink-soft">
          <li>
            Búsqueda en vivo y directorio por municipio provistos por la API de MedSeek PR (medseekpr.com), con cobertura en los 78 municipios de Puerto Rico.
          </li>
          {catalog.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <img
            src="/art/medseek-logo.png"
            alt="MedSeek"
            width={120}
            height={40}
            loading="lazy"
            className="h-10 w-auto shrink-0 object-contain"
          />
          <p className="text-base text-ink-soft">
            Datos de proveedores por MedSeek.
          </p>
        </div>
        <p className="text-base text-ink-soft">
          {catalog.attribution}. Datos de localización y NPI vía MedSeek PR.{" "}
          <a href={VERIFY_URL} target="_blank" rel="noreferrer noopener" className="font-bold underline">
            Verifique cualquier licencia usted misma
          </a>{" "}
          en el registro de la Junta de Licenciamiento y Disciplina Médica.
        </p>
      </section>
    </main>
  );
}
