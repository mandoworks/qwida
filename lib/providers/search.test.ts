import { describe, expect, it } from "vitest";
import { providers } from "./catalog";
import {
  SPECIALTIES,
  activeFilters,
  matchesSpecialty,
  municipios,
  municipioOptions,
  normalize,
  searchProviders,
  specialtyOptions,
} from "./search";

const licenses = (list: { license_number: string }[]) => list.map((p) => p.license_number);

describe("normalize", () => {
  it("makes accents, case and padding irrelevant", () => {
    expect(normalize("  CARDIOLOGÍA  ")).toBe("cardiologia");
    expect(normalize("PEDIATRÍA")).toBe("pediatria");
  });
});

describe("searchProviders", () => {
  it("returns every active record when no filter is set", () => {
    expect(searchProviders(providers)).toHaveLength(providers.length);
    expect(searchProviders(providers, { specialty: "", municipio: "" })).toHaveLength(providers.length);
    expect(searchProviders(providers, { specialty: null, municipio: null })).toHaveLength(providers.length);
  });

  it("filters by specialty without accents on either side", () => {
    const cardiology = searchProviders(providers, { specialty: "Cardiología" });
    expect(cardiology).toHaveLength(providers.length);
    expect(cardiology.every((p) => matchesSpecialty(p, "cardiologia"))).toBe(true);
  });

  it("separates the interventional and pediatric certification strings", () => {
    const interventional = searchProviders(providers, { specialty: "cardiologia intervencional" });
    expect(interventional.map((p) => p.name)).toEqual([
      "ALEJANDRO J LOPEZ MAS",
      "EDGARDO BERMUDEZ MORENO",
      "RAFAEL J RIVERA BERRIOS",
    ]);
    expect(searchProviders(providers, { specialty: "cardiologia pediatrica" }).map((p) => p.name)).toEqual([
      "ANA D FINCH MATEO",
    ]);
  });

  it("filters by municipio of work, exact", () => {
    expect(searchProviders(providers, { municipio: "ponce" })).toHaveLength(providers.length);
    expect(searchProviders(providers, { municipio: "adjuntas" })).toHaveLength(0);
  });

  it("combines both filters and never mutates the input", () => {
    const before = providers.length;
    const result = searchProviders(providers, { specialty: "medicina interna", municipio: "Ponce" });
    expect(licenses(result)).toContain("11205");
    expect(result.some((p) => p.name === "ANA D FINCH MATEO")).toBe(false);
    expect(providers).toHaveLength(before);
  });
});

describe("shipped data", () => {
  it("only holds active licenses, which is what the page promises", () => {
    expect(providers.every((p) => p.license_status === "ACTIVO")).toBe(true);
  });

  it("has one license number per record and a real phone or an honest null", () => {
    const licenses = providers.map((p) => p.license_number);
    expect(new Set(licenses).size).toBe(licenses.length);
    expect(providers.filter((p) => p.phone).length).toBeGreaterThan(0);
    expect(providers.some((p) => p.phone === null)).toBe(true);
  });

  it("keeps every record reachable from a specialty option, so no card is unreachable", () => {
    for (const provider of providers) {
      expect(SPECIALTIES.some((s) => matchesSpecialty(provider, s.value))).toBe(true);
    }
  });

  it("offers only municipios that are in the data", () => {
    expect(municipios(providers)).toEqual(["PONCE"]);
  });
});

/**
 * Marley QA (production 6c89d18): "the filters do not re filter the list".
 * The wiring was never broken, the snapshot is one specialty in one
 * municipio, so the two obvious choices left 15 of 15 and looked dead.
 * These counts are what now makes that visible on the page.
 */
describe("specialtyOptions", () => {
  const countFor = (value: string) => specialtyOptions(providers).find((o) => o.value === value)?.count;

  it("keeps the no filter row first, labeled Todas", () => {
    const first = specialtyOptions(providers)[0];
    expect(first).toEqual({ value: "", label: "Todas", count: providers.length });
  });

  it("counts every row the way searchProviders filters", () => {
    for (const option of specialtyOptions(providers)) {
      expect(option.count).toBe(searchProviders(providers, { specialty: option.value }).length);
    }
  });

  it("reports honestly that Cardiología cannot narrow this catalog", () => {
    expect(countFor("cardiologia")).toBe(providers.length);
    expect(countFor("cardiologia intervencional")).toBe(3);
    expect(countFor("cardiologia pediatrica")).toBe(1);
    expect(countFor("medicina interna")).toBe(14);
  });

  it("keeps its counts inside a chosen municipio", () => {
    const options = specialtyOptions(providers, { municipio: "Ponce" });
    for (const option of options) {
      expect(option.count).toBe(searchProviders(providers, { specialty: option.value, municipio: "Ponce" }).length);
    }
    expect(options.find((o) => o.value === "cardiologia intervencional")?.count).toBe(3);
  });

  it("drops to zero for a town with nothing in it", () => {
    expect(specialtyOptions(providers, { municipio: "Adjuntas" }).every((o) => o.count === 0)).toBe(true);
  });
});

describe("municipioOptions", () => {
  it("offers Todos plus every municipio in the data, in Spanish", () => {
    expect(municipioOptions(providers)).toEqual([
      { value: "", label: "Todos", count: providers.length },
      { value: "PONCE", label: "Ponce", count: providers.length },
    ]);
  });

  it("narrows its counts with the specialty already applied", () => {
    expect(municipioOptions(providers, { specialty: "cardiologia pediatrica" }).map((o) => o.count)).toEqual([1, 1]);
    expect(municipioOptions(providers, { specialty: "cardiologia intervencional" }).map((o) => o.count)).toEqual([3, 3]);
  });
});

describe("activeFilters", () => {
  it("says nothing when nothing is being filtered", () => {
    expect(activeFilters({})).toBe("");
    expect(activeFilters({ specialty: "", municipio: null })).toBe("");
    expect(activeFilters({ specialty: "   ", municipio: " " })).toBe("");
  });

  it("names what she picked, in the label she read in the select", () => {
    expect(activeFilters({ specialty: "cardiologia intervencional" })).toBe(
      "Especialidad: Cardiología intervencional.",
    );
    expect(activeFilters({ municipio: "Ponce" })).toBe("Municipio: Ponce.");
  });

  it("reads both filters together", () => {
    expect(activeFilters({ specialty: "pediatria", municipio: "PONCE" })).toBe(
      "Especialidad: Pediatría. Municipio: Ponce.",
    );
  });

  it("does not invent accents for a term that is not a listed option", () => {
    expect(activeFilters({ specialty: "dermatologia" })).toBe("Especialidad: Dermatologia.");
  });
});
