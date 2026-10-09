/** Simple line icons for the caregiver sections, until the drawings arrive. */
export function NavIcon({ href }: { href: string }) {
  const d = PATHS[href] ?? PATHS["/cuidador"];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
      <path d={d} />
    </svg>
  );
}

const PATHS: Record<string, string> = {
  "/cuidador": "M3 11l9-7 9 7M5 10v9h5v-6h4v6h5v-9",
  "/cuidador/revisar": "M4 5h11l4 4v10H4zM8 13l3 3 5-6",
  "/cuidador/tiempo": "M6 3v18M6 7h14M6 12h14M6 17h9",
  "/cuidador/tarjeta": "M4 6h16v12H4zM4 10h16M8 15h5",
  "/cuidador/recordatorios": "M6 5v14l3-2h9V5zM10 9h5M10 12h4",
  "/cuidador/ajustes": "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M7.7 16.3l-1.4 1.4",
};
